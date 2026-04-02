# AI Assistant Integration Guide

## Overview
The backend provides `/assistant/explain` endpoint to generate clinical or patient-friendly explanations of ML diagnostic outputs. This guide explains how to integrate it into the clinical dashboard.

---

## Endpoint Details

### POST /assistant/explain
**Description:** Generate explanation for ML diagnostic output using AI

**Request:**
```json
{
  "ml_output": {
    "preeclampsia": {
      "risk_level": "HIGH",
      "probability": 0.78
    },
    "gdm": {
      "risk_level": "MODERATE", 
      "probability": 0.45
    },
    "preterm_birth": {
      "risk_level": "LOW",
      "probability": 0.12
    },
    "primary_risk": "preeclampsia",
    "explainability": [
      {
        "feature": "systolic_bp",
        "importance": 0.92,
        "contribution": 0.34,
        "direction": "increase",
        "value": "160 mmHg",
        "status": "abnormal",
        "clinical_hint": "Elevated systolic BP suggests preeclampsia"
      }
    ]
  },
  "requester_role": "CLINICAL_SPECIALIST"  // or "PATIENT"
}
```

**Response:**
```json
{
  "explanation": "Based on clinical analysis, elevated systolic BP (160 mmHg) and other biomarkers suggest high risk of preeclampsia...",
  "role": "CLINICAL_SPECIALIST",
  "confidence": 0.82,
  "recommendations": [
    "Continue BP monitoring every 6 hours",
    "Repeat PE biomarkers in 48 hours",
    "Consider specialist referral"
  ],
  "model_version": "2.1"
}
```

---

## Integration Steps

### Step 1: Add State & Types to Clinical Dashboard

Add these to clinical-dashboard.tsx:

```typescript
interface ExplanationResponse {
  explanation: string
  role: string
  confidence: number
  recommendations: string[]
  model_version: string
}

interface ClinicalDashboard {
  // ... existing state ...
  
  // Add new state:
  const [aiExplanation, setAiExplanation] = useState<ExplanationResponse | null>(null)
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false)
  const [explanationError, setExplanationError] = useState<string | null>(null)
}
```

### Step 2: Add API Call Function

After `handleEvaluateDifferential()` function, add:

```typescript
const callAIExplainer = async () => {
  if (!differentialResult) {
    setExplanationError("Run differential diagnosis first")
    return
  }

  try {
    setIsGeneratingExplanation(true)
    setExplanationError(null)
    
    const response = await apiRequest("/assistant/explain", {
      method: "POST",
      body: JSON.stringify({
        ml_output: {
          preeclampsia: differentialResult.preeclampsia,
          gdm: differentialResult.gdm,
          preterm_birth: differentialResult.preterm_birth,
          primary_risk: differentialResult.primary_risk,
          explainability: differentialResult.explainability
        },
        requester_role: "CLINICAL_SPECIALIST"
      })
    })

    if (!response.ok) {
      throw new Error("Failed to generate explanation")
    }

    const explanation: ExplanationResponse = await response.json()
    setAiExplanation(explanation)
  } catch (err) {
    setExplanationError(err instanceof Error ? err.message : "Failed to generate explanation")
  } finally {
    setIsGeneratingExplanation(false)
  }
}
```

### Step 3: Call Explainer After Differential Evaluation

In `handleEvaluateDifferential()`, after successfully retrieving differential result and setting state:

```typescript
const handleEvaluateDifferential = async () => {
  // ... existing code to evaluate differential ...
  
  // After setting differentialResult:
  const payload = await response.json()
  setDifferentialResult(payload)
  
  // ✅ ADD THIS: Auto-generate explanation after getting results
  setTimeout(() => {
    // The explanation will be generated with the latest differentialResult
    // We'll trigger it in the UI button, but could auto-call here if desired
  }, 500)
  
  // ... rest of function ...
}
```

### Step 4: Add UI Component to Display Explanation

Add this Card component after the Differential Results section in the clinical dashboard JSX:

```jsx
{/* AI Explanation Card */}
{aiExplanation && (
  <Card className="border-blue-200 bg-blue-50 mt-6">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-blue-600" />
        {getText("AI Clinical Explanation", "AI ක්‍රිනිකල් ඇහැඳිය", "AI மருத்துவ விளக்கம்")}
        <Badge variant="secondary" className="ml-auto text-xs">
          {(aiExplanation.confidence * 100).toFixed(0)}% Confidence
        </Badge>
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* Main Explanation */}
      <div className="p-4 bg-white rounded-lg border border-blue-200">
        <p className="text-gray-700 leading-relaxed">
          {aiExplanation.explanation}
        </p>
      </div>

      {/* Recommendations */}
      {aiExplanation.recommendations && aiExplanation.recommendations.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            {getText("Recommended Actions", "නිර්දේශිත ක්‍රියාවලි", "பரிந்துரைக்கப்பட்ட நடவடிக்கைகள்")}
          </h4>
          <ul className="space-y-2">
            {aiExplanation.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <ArrowRight className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Metadata */}
      <div className="pt-2 border-t border-blue-200 flex items-center justify-between text-xs text-gray-500">
        <span>{getText("Model Version", "ආදර්ශ සংස්කරණ", "மாதிரி பதிப்பு")}: {aiExplanation.model_version}</span>
        <span>{getText("For", "සඳහා", "க்கிற")} {aiExplanation.role}</span>
      </div>
    </CardContent>
  </Card>
)}

{/* Explanation Error */}
{explanationError && (
  <Card className="border-red-200 bg-red-50 mt-6">
    <CardContent className="pt-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-900">{explanationError}</p>
      </div>
    </CardContent>
  </Card>
)}
```

### Step 5: Add Button to Generate Explanation

Add a button in the Differential Results section to trigger explanation generation:

```jsx
{/* In the differential results area, add this button: */}
{differentialResult && (
  <Button 
    onClick={callAIExplainer}
    disabled={isGeneratingExplanation}
    className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
  >
    <Brain className="w-4 h-4" />
    {isGeneratingExplanation ? "Generating Explanation..." : "Generate AI Explanation"}
  </Button>
)}
```

---

## Testing Checklist

- [ ] Differential diagnosis runs successfully
- [ ] Click "Generate AI Explanation" button
- [ ] Explanation response displays correctly
- [ ] Recommendations are shown in a list
- [ ] Confidence score and model version displayed
- [ ] Error messages appear if API fails
- [ ] Language switching doesn't break explanation display
- [ ] Mobile responsive layout

---

## Error Handling

The integration includes handling for:
- Missing differential result (pre-validation)
- Network failures (fallback error message)
- API errors (HTTP status codes)
- Missing recommendations in response
- Null/undefined explanation fields

---

## Performance Considerations

- Explanation generation may take 2-5 seconds (LLM inference)
- Show loading state during generation
- Cache explanation results to avoid re-calling for same result
- Consider rate limiting to avoid excessive API calls

---

## Multilingual Support

The explanation text is generated by the backend LLM based on the `requester_role`. The UI buttons and labels are translated via the `getText()` function.

If you want role-specific explanations:
- `CLINICAL_SPECIALIST` → Clinical, detailed, with references
- `PATIENT` → Simple language, educational tone
- `FRONTLINE_STAFF` → Structured, actionable guidance

---

## Related Code References

**Import these icons at top of clinical-dashboard.tsx:**
```typescript
import { Brain, Check Circle, ArrowRight } from "lucide-react"
```

**API Request pattern (already exists in component):**
```typescript
const apiRequest = async (path: string, init?: RequestInit): Promise<Response> => {
  // Uses Bearer token from localStorage
  // Multi-URL fallback strategy
}
```

---

## Deployment Notes

Before deploying, ensure:
1. Backend has `OPENAI_API_KEY` configured (or using mock LLM)
2. Check `BLOOMCARE_MOCK_LLM` setting in backend config
3. Test with actual clinical data
4. Verify explanation quality with domain experts
5. Monitor API response times and costs (if using commercial LLM)

---

**Estimated Integration Time:** 15-20 minutes  
**Complexity:** Low (straightforward API integration)  
**Risk Level:** Low (read-only operation, no data mutation)
