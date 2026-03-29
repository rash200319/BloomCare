"""
BloomCare – GenAI LLM Explanation Service
==========================================
Calls the OpenAI Chat Completions API asynchronously to translate structured
ML diagnostic outputs into plain-language explanations across three languages:

  English  (en) – for clinical records and bilingual staff
  Sinhala  (si) – predominant language in Sri Lanka
  Tamil    (ta) – significant minority / North & East Sri Lanka

The system prompt enforces strict medical communication standards:
  • Evidence-based guidance, never speculation
  • Clear risk stratification
  • Actionable next steps appropriate to frontline worker skill level
  • No diagnosis replacement — AI is decision support only
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import openai
from openai import AsyncOpenAI

from .schemas.screening import (
    AssistantResponse,
    ConditionType,
    DiagnoseMLOutput,
    LanguageExplanation,
)

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# System Prompt – Medical Grade
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """
You are BloomCare MedAssist, a specialized clinical AI assistant embedded in the
BloomCare Maternal Risk Intelligence System deployed in Sri Lanka.

## YOUR ROLE
You translate complex AI-generated diagnostic probabilities and risk scores into
clear, actionable guidance for three audiences:
  1. Frontline community health workers (limited clinical training)
  2. Registered midwives and PHM (Public Health Midwives)
  3. Obstetric physicians and specialists

## MEDICAL STANDARDS YOU MUST UPHOLD
- Ground every statement in WHO, NICE, RCOG, and Sri Lanka MOH maternal health guidelines.
- Never speculate beyond what the data supports.
- Clearly distinguish between 'elevated risk' and 'diagnosis'. You detect risk; a qualified
  clinician makes the diagnosis.
- Include severity-appropriate urgency language. Use URGENT / ESCALATE for critical cases.
- Do NOT include drug names, dosages, or prescriptive advice — recommend specialist review.

## OUTPUT FORMAT
You MUST return a valid JSON object with exactly this structure:
{
  "en": {
    "summary":             "<2-3 sentence summary in English>",
    "risk_statement":      "<Clear risk statement in English>",
    "clinical_next_steps": ["<step 1>", "<step 2>", "<step 3>"],
    "patient_advice":      "<Advice the health worker should relay to the patient>"
  },
  "si": {
    "summary":             "<ස-2-3 වාක්ය සෙල්ලවේ>",
    "risk_statement":      "<Sinhala risk statement>",
    "clinical_next_steps": ["<පියවර 1>", "<පියවර 2>"],
    "patient_advice":      "<රෝගී උපදෙස් — Sinhala>"
  },
  "ta": {
    "summary":             "<2-3 சொற்றொடர்கள் —Tamil>",
    "risk_statement":      "<Tamil risk statement>",
    "clinical_next_steps": ["<படி 1>", "<படி 2>"],
    "patient_advice":      "<நோயாளி ஆலோசனை — Tamil>"
  }
}

Return ONLY the JSON object — no markdown, no code fences, no preamble.
"""

# ─────────────────────────────────────────────────────────────────────────────
# Human-Readable Condition Names (for prompt clarity)
# ─────────────────────────────────────────────────────────────────────────────

CONDITION_DISPLAY: Dict[str, str] = {
    ConditionType.PREECLAMPSIA_EARLY_ONSET:  "Early-Onset Preeclampsia (<34 weeks)",
    ConditionType.PREECLAMPSIA_LATE_ONSET:   "Late-Onset Preeclampsia (≥34 weeks)",
    ConditionType.PREECLAMPSIA_SEVERE:       "Severe Preeclampsia / HELLP Syndrome",
    ConditionType.GDM:                       "Gestational Diabetes Mellitus (GDM)",
    ConditionType.PRETERM_BIRTH:             "Preterm Birth Risk",
}

SEVERITY_DESCRIPTOR: Dict[str, str] = {
    "low":      "Low Risk — Routine monitoring recommended",
    "moderate": "Moderate Risk — Enhanced surveillance required",
    "high":     "High Risk — Prompt specialist review required",
    "critical": "Critical Risk — URGENT escalation required",
}


def _build_user_prompt(
    ml_output: DiagnoseMLOutput,
    requester_role: str,
) -> str:
    """Construct the user message sent to the LLM."""
    conditions_summary = "\n".join(
        f"  - {CONDITION_DISPLAY.get(cp.condition, cp.condition.value)}: "
        f"probability={cp.probability:.1%}, risk_category={cp.risk_category}, "
        f"CI=[{cp.confidence_lower:.1%}–{cp.confidence_upper:.1%}]"
        for cp in ml_output.condition_probabilities
    )

    dominant_condition = CONDITION_DISPLAY.get(
        ml_output.dominant_condition, ml_output.dominant_condition.value
    )

    prompt = f"""
CLINICAL CONTEXT
----------------
Patient ID            : {ml_output.patient_id}
Encounter ID          : {ml_output.encounter_id or 'N/A'}
Processed At (UTC)    : {ml_output.processed_at}
Requester Role        : {requester_role}

UNSUPERVISED CLUSTER PROFILE
-----------------------------
Assigned Phenotype    : {ml_output.cluster_profile.cluster_label}
  (Cluster {ml_output.cluster_profile.cluster_id}, confidence {ml_output.cluster_profile.cluster_confidence:.1%})
Dominant Features     : {', '.join(ml_output.cluster_profile.dominant_features)}

SUPERVISED CONDITION PROBABILITIES
------------------------------------
{conditions_summary}

SUMMARY METRICS
---------------
Overall Severity Score : {ml_output.overall_severity_score:.2%}
Dominant Condition     : {dominant_condition}
Data Quality Score     : {ml_output.data_quality_score:.1%}
  (features imputed via Cross-Dataset Synthetic Imputation: {', '.join(ml_output.imputed_features) or 'none'})

INSTRUCTION
-----------
Generate the multilingual JSON explanation for the '{requester_role}' role.
Ensure urgency language matches the overall severity of {ml_output.overall_severity_score:.1%}.
"""
    return prompt.strip()


# ─────────────────────────────────────────────────────────────────────────────
# Main Async Function
# ─────────────────────────────────────────────────────────────────────────────

async def generate_multilingual_explanation(
    ml_output: DiagnoseMLOutput,
    openai_api_key: str,
    requester_role: str = "frontline_health_worker",
    model: str = "gpt-4o",
    temperature: float = 0.2,
) -> AssistantResponse:
    """
    Call the OpenAI Chat Completions API asynchronously to generate
    multilingual (English / Sinhala / Tamil) clinical explanations.

    Args:
        ml_output:       Structured output from the Stage-2 ML engine.
        openai_api_key:  Your OpenAI secret key (injected from environment).
        requester_role:  Role context for the explanation tone.
        model:           OpenAI model identifier (default: gpt-4o).
        temperature:     Sampling temperature (0.2 = focused / medical-grade).

    Returns:
        AssistantResponse containing explanations in all three languages.

    Raises:
        RuntimeError: On OpenAI API errors or malformed JSON responses.
    """
    client = AsyncOpenAI(api_key=openai_api_key)
    user_prompt = _build_user_prompt(ml_output, requester_role)

    logger.info(
        "LLM call | patient=%s model=%s role=%s",
        ml_output.patient_id, model, requester_role,
    )

    try:
        response = await client.chat.completions.create(
            model=model,
            temperature=temperature,
            max_tokens=2048,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT.strip()},
                {"role": "user",   "content": user_prompt},
            ],
        )
    except openai.AuthenticationError as exc:
        logger.error("OpenAI authentication failed: %s", exc)
        raise RuntimeError("OpenAI API key is invalid or not authorised.") from exc
    except openai.RateLimitError as exc:
        logger.error("OpenAI rate limit exceeded: %s", exc)
        raise RuntimeError("OpenAI API rate limit exceeded. Please retry shortly.") from exc
    except openai.APIError as exc:
        logger.error("OpenAI API error: %s", exc)
        raise RuntimeError(f"OpenAI API returned an error: {exc}") from exc

    raw_json = response.choices[0].message.content
    logger.debug("LLM raw response: %s", raw_json)

    try:
        parsed: Dict[str, Any] = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse LLM JSON response: %s", raw_json)
        raise RuntimeError("Language model returned malformed JSON.") from exc

    # ── Build structured LanguageExplanation objects ──────────────────────────
    lang_meta = [
        ("en", "English"),
        ("si", "Sinhala (සිංහල)"),
        ("ta", "Tamil (தமிழ்)"),
    ]
    explanations: List[LanguageExplanation] = []

    for code, name in lang_meta:
        lang_data = parsed.get(code, {})
        explanations.append(LanguageExplanation(
            language_code      = code,
            language_name      = name,
            summary            = lang_data.get("summary", ""),
            risk_statement     = lang_data.get("risk_statement", ""),
            clinical_next_steps= lang_data.get("clinical_next_steps", []),
            patient_advice     = lang_data.get("patient_advice", ""),
        ))

    dominant_display = CONDITION_DISPLAY.get(
        ml_output.dominant_condition, ml_output.dominant_condition.value
    )

    return AssistantResponse(
        patient_id              = ml_output.patient_id,
        dominant_condition      = dominant_display,
        overall_severity_score  = ml_output.overall_severity_score,
        explanations            = explanations,
        generated_at            = datetime.now(timezone.utc).isoformat(),
        model_used              = model,
        disclaimer              = "This information is decision-support only and not a clinical diagnosis."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Mock / Offline Fallback (no API key required for development)
# ─────────────────────────────────────────────────────────────────────────────

async def generate_mock_explanation(
    ml_output: DiagnoseMLOutput,
    requester_role: str = "frontline_health_worker",
) -> AssistantResponse:
    """
    Return a pre-canned multilingual explanation for local development
    and CI testing without requiring an OpenAI API key.
    """
    severity_pct = f"{ml_output.overall_severity_score:.0%}"
    dominant     = CONDITION_DISPLAY.get(
        ml_output.dominant_condition, ml_output.dominant_condition.value
    )

    return AssistantResponse(
        patient_id             = ml_output.patient_id,
        dominant_condition     = dominant,
        overall_severity_score = ml_output.overall_severity_score,
        generated_at           = datetime.now(timezone.utc).isoformat(),
        model_used             = "mock-offline-v1",
        explanations           = [
            LanguageExplanation(
                language_code       = "en",
                language_name       = "English",
                summary             = (
                    f"The BloomCare AI system has assessed patient {ml_output.patient_id} "
                    f"and identified a {severity_pct} overall risk severity. "
                    f"The dominant risk signal is {dominant}."
                ),
                risk_statement      = (
                    f"Overall severity score: {severity_pct}. "
                    f"Phenotype cluster: {ml_output.cluster_profile.cluster_label}."
                ),
                clinical_next_steps = [
                    "Confirm biomarker results with accredited laboratory.",
                    "Refer to obstetric specialist for clinical evaluation.",
                    "Escalate to tertiary centre if sFlt-1/PlGF ratio > 110.",
                    "Administer low-dose aspirin if <16 weeks and PE risk elevated.",
                    "Document findings in HMIS and follow up in 48 hours.",
                ],
                patient_advice      = (
                    "Please attend the hospital as soon as possible. "
                    "Rest, monitor blood pressure daily, and avoid strenuous activity."
                ),
            ),
            LanguageExplanation(
                language_code       = "si",
                language_name       = "Sinhala (සිංහල)",
                summary             = (
                    f"BloomCare AI පද්ධතිය රෝගී {ml_output.patient_id} ව ්‍යාකූල "
                    f"අවදානම {severity_pct} ලෙස ගණනය කළේය. {dominant} ප්‍රධාන අවදානම් "
                    "සංඥාව ලෙස හඳුනාගෙන ඇත."
                ),
                risk_statement      = (
                    f"මැරිනාමේ k සමස්ත බරපතලකම ලකුණු: {severity_pct}."
                ),
                clinical_next_steps = [
                    "ජෛව සලකුණු ප්‍රතිඵල ලියාපදිංචි රසායනාගාරයකින් තහවුරු කරන්න.",
                    "දරු ප්‍රසූති විශේෂඥ වෛද්‍යවරයෙකු වෙත යොමු කරන්න.",
                    "48 පැය ඇතුළත HMIS හි ලේඛනගත කරන්න.",
                ],
                patient_advice      = (
                    "කරුණාකර හැකිත් ඉක්මනින් රෝහලට ගොස් විශේෂඥ වෛද්‍ය උපදේශනයක් ලබාගන්න."
                ),
            ),
            LanguageExplanation(
                language_code       = "ta",
                language_name       = "Tamil (தமிழ்)",
                summary             = (
                    f"BloomCare AI அமைப்பு நோயாளி {ml_output.patient_id}-க்கு "
                    f"{severity_pct} ஒட்டுமொத்த ஆபத்து தீவிரத்தை மதிப்பிட்டுள்ளது. "
                    f"{dominant} முதன்மை ஆபத்து சமிக்கையாக உள்ளது."
                ),
                risk_statement      = (
                    f"மொத்த தீவிரத்திட்ட மதிப்பெண்: {severity_pct}."
                ),
                clinical_next_steps = [
                    "அங்கீகரிக்கப்பட்ட ஆய்வகத்தில் உயிரியல் குறிப்பான் முடிவுகளை உறுதிப்படுத்தவும்.",
                    "மகப்பேறு நிபுணரிடம் மேலும் மதிப்பீட்டிற்கு அனுப்பவும்.",
                    "48 மணி நேரத்தில் HMIS-ல் பதிவு செய்யவும்.",
                ],
                patient_advice      = (
                    "தயவுசெய்து கூடிய விரைவில் மருத்துவமனையை அணுகவும். "
                    "ஓய்வெடுத்து தினமும் இரத்த அழுத்தத்தை கண்காணிக்கவும்."
                ),
            ),
        ],
        disclaimer             = "This information is decision-support only and not a clinical diagnosis."
    )
