from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from typing import Any, Optional, Dict, List
from sqlalchemy import String, cast
from sqlalchemy.orm import Session
import logging
from datetime import datetime
import json
import uuid
from io import BytesIO

from backend.core.deps import get_db, get_current_active_user, ensure_patient_access
from backend.schemas.screening import PatientReportRequest, PatientReportResponse, Stage1ScreeningReportData
from backend.models.user import User
from backend.models.patient import Patient as DBPatient
from backend.models.screening import Stage1Screening, Stage2Diagnostic, PatientReport

logger = logging.getLogger(__name__)

router = APIRouter()


def _format_contributing_factors(factors: Dict[str, float]) -> List[str]:
    """Convert contributing factors dict to human-readable list."""
    if not factors:
        return []

    # Sort by importance
    sorted_factors = sorted(factors.items(), key=lambda x: x[1], reverse=True)

    factor_descriptions = {
        "severe_hypertension": "Severe high blood pressure (≥160/110 mmHg)",
        "hypertension": "High blood pressure (≥140/90 mmHg)",
        "obesity": "Obesity (BMI ≥ 30)",
        "overweight": "Overweight (BMI 25-29)",
        "advanced_maternal_age": "Advanced maternal age (≥35 years)",
        "elevated_blood_sugar": "Elevated blood sugar (>6.0 mmol/L)",
        "anemia": "Anemia (Hemoglobin <10.5 g/dL)",
        "high_hemoglobin": "High hemoglobin (>13 g/dL)",
        "preexisting_diabetes": "Pre-existing diabetes",
        "pcos": "Polycystic ovary syndrome (PCOS)",
        "previous_obstetric_complications": "Previous obstetric complications",
        "mental_health_concerns": "Mental health concerns",
    }

    descriptions = []
    for factor, importance in sorted_factors:
        desc = factor_descriptions.get(
            factor, factor.replace("_", " ").title())
        importance_pct = round(importance * 100)
        descriptions.append(f"• {desc} ({importance_pct}%)")

    return descriptions


def _pdf_text(value: Any) -> str:
    if value is None or value == "":
        return "--"
    text = str(value).replace("\u2014", "-").replace("\u2013", "-")
    return text.encode("latin-1", "replace").decode("latin-1")


def _probability_label(payload: Any) -> str:
    if isinstance(payload, dict):
        probability = payload.get("probability")
        risk_level = payload.get("risk_level")
        if probability is None:
            return _pdf_text(risk_level or payload)
        percent = f"{float(probability) * 100:.1f}%"
        return _pdf_text(f"{percent}  ({risk_level})" if risk_level else percent)
    if isinstance(payload, (int, float)):
        return f"{float(payload) * 100:.1f}%"
    return _pdf_text(payload)


def _build_report_pdf(content: Dict[str, Any], report_type: str) -> bytes:
    from fpdf import FPDF

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    pdf.set_fill_color(244, 63, 94)
    pdf.rect(0, 0, 210, 22, "F")
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_xy(12, 6)
    title = "BloomCare  |  Stage 2 Diagnostic Report" if report_type == "stage2" else "BloomCare  |  Stage 1 Screening Report"
    pdf.cell(0, 10, _pdf_text(title), new_x="LMARGIN", new_y="NEXT")

    pdf.set_text_color(30, 41, 59)
    pdf.ln(10)
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 8, _pdf_text(content.get("report_title") or "Clinical Report"), new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(0, 6, _pdf_text(f"Generated: {content.get('generated_date', '--')}"), new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, _pdf_text(f"Prepared by: {content.get('generated_by', '--')}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    def section(heading: str) -> None:
        pdf.ln(2)
        pdf.set_fill_color(255, 241, 242)
        pdf.set_text_color(190, 18, 60)
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 8, f"  {_pdf_text(heading)}", new_x="LMARGIN", new_y="NEXT", fill=True)
        pdf.set_text_color(30, 41, 59)
        pdf.set_font("Helvetica", "", 10)

    def row(label: str, value: Any) -> None:
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(58, 7, _pdf_text(label))
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 7, _pdf_text(value), new_x="LMARGIN", new_y="NEXT")

    section("Patient")
    row("Name", content.get("patient_name"))
    row("Patient ID", content.get("patient_id"))
    row("Gestational age", f"{content.get('gestational_age_weeks', '--')} weeks")

    if report_type == "stage2":
        section("Differential diagnosis")
        row("Primary risk", content.get("dominant_condition") or content.get("disease_checked"))
        row("Severity score", content.get("overall_severity_score"))
        row("Model", content.get("model_used"))
        row("Evaluated", content.get("evaluated_date"))

        probabilities = content.get("condition_probabilities") or {}
        if isinstance(probabilities, dict) and probabilities:
            section("Condition probabilities")
            for name, payload in probabilities.items():
                if name == "primary_risk":
                    continue
                row(str(name).replace("_", " ").title(), _probability_label(payload))

        biomarkers = content.get("biomarkers") or {}
        if isinstance(biomarkers, dict) and biomarkers:
            section("Lab / biomarkers")
            for name, value in biomarkers.items():
                row(str(name), value)

        labs = content.get("lab_inputs") or {}
        if isinstance(labs, dict) and labs:
            section("Specialist lab inputs")
            for name, value in labs.items():
                row(str(name).replace("_", " ").title(), value)
    else:
        section("Stage 1 screening")
        row("Risk classification", content.get("risk_classification"))
        row("Risk score", content.get("risk_score"))
        row("Screening date", content.get("screening_date"))
        vitals = content.get("vitals") or {}
        if isinstance(vitals, dict):
            section("Vitals")
            for name, value in vitals.items():
                row(str(name).replace("_", " ").title(), value)
        factors = content.get("contributing_factors") or []
        if factors:
            section("Contributing factors")
            pdf.set_font("Helvetica", "", 10)
            for factor in factors:
                pdf.multi_cell(0, 6, _pdf_text(factor))
        recommendations = content.get("recommendations") or []
        if recommendations:
            section("Recommendations")
            for item in recommendations:
                pdf.multi_cell(0, 6, _pdf_text(f"- {item}"))

    pdf.ln(8)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(100, 116, 139)
    pdf.multi_cell(
        0,
        5,
        "This report is clinical decision-support generated by BloomCare. It is not a diagnostic authority and must be interpreted by a qualified clinician.",
    )

    return bytes(pdf.output())


@router.post("/stage1", response_model=PatientReportResponse)
def generate_stage1_report(
    request: PatientReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Generate a downloadable Stage 1 screening report."""
    
    try:
        # Retrieve stage 1 screening
        stage1 = db.query(Stage1Screening).filter(
            Stage1Screening.id == request.stage1_screening_id
        ).first()
        
        if not stage1:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stage 1 screening not found"
            )
        
        # Check authorization
        if stage1.patient_id != current_user.id and current_user.role.value != "ADMIN":
            # Allow clinicians to view patient records
            if current_user.role.value not in ["CLINICAL_SPECIALIST", "FRONTLINE_STAFF"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to generate this report"
                )
        
        # Format contributing factors
        contributing_factor_list = _format_contributing_factors(stage1.contributing_factors or {})
        
        # Determine risk category
        risk_category = "HIGH RISK - ESCALATION REQUIRED" if stage1.edge_risk_classification.value == "escalate" else "ROUTINE CARE"
        recommendations = [
            "Consult with a maternal-fetal medicine specialist",
            "Schedule Stage 2 diagnostic evaluation",
            "Monitor vital signs regularly",
            "Maintain healthy lifestyle and diet"
        ] if stage1.edge_risk_classification.value == "escalate" else [
            "Continue routine antenatal care",
            "Maintain regular follow-up appointments",
            "Monitor for any concerning symptoms"
        ]
        
        # Safe datetime handling
        collected_at = stage1.collected_at if stage1.collected_at else stage1.synced_at
        
        # Create report content
        report_content = {
            "report_title": request.title or f"Stage 1 Screening Report - {stage1.created_at.strftime('%Y-%m-%d')}",
            "patient_id": str(stage1.patient_id),
            "screening_date": collected_at.isoformat() if collected_at else stage1.synced_at.isoformat(),
            "gestational_age_weeks": stage1.gestational_age_weeks,
            "vitals": {
                "age": stage1.age,
                "blood_pressure": f"{stage1.systolic}/{stage1.diastolic} mmHg" if (stage1.systolic and stage1.diastolic) else "Not recorded",
                "bmi": f"{stage1.bmi} kg/m²" if stage1.bmi else "Not recorded",
                "heart_rate": f"{stage1.heart_rate} bpm" if stage1.heart_rate else "Not recorded",
                "temperature": f"{stage1.temperature}°C" if stage1.temperature else "Not recorded",
                "blood_sugar": f"{stage1.Blood_sugar} mmol/L" if stage1.Blood_sugar else "Not recorded",
                "hemoglobin": f"{stage1.hemoglobin} g/dL" if stage1.hemoglobin else "Not recorded",
            },
            "risk_classification": risk_category,
            "risk_score": float(stage1.edge_risk_score),
            "contributing_factors": contributing_factor_list,
            "clinical_summary": f"Patient presents with a general risk score of {stage1.edge_risk_score:.3f}. Key factors contributing to this assessment include: {', '.join([f.split('(')[0].strip() for f in contributing_factor_list[:3]])}.",
            "recommendations": recommendations,
            "next_steps": "Patient should schedule an appointment with a maternal-fetal medicine specialist for Stage 2 diagnostic evaluation within 2 weeks." if stage1.edge_risk_classification.value == "escalate" else "Patient may continue with routine antenatal care. Schedule follow-up in 4 weeks or as recommended by primary care provider.",
            "generated_date": datetime.utcnow().isoformat(),
            "generated_by": current_user.full_name or current_user.email,
        }
        
        # Save report to database
        report_id = str(uuid.uuid4())
        db_report = PatientReport(
            id=report_id,
            patient_id=str(stage1.patient_id),
            stage1_screening_id=str(stage1.id),
            stage2_diagnostic_id=None,
            report_type="stage1",
            report_title=report_content["report_title"],
            content_type="json",
            report_content=report_content,
            generated_by=str(current_user.id),
        )
        db.add(db_report)
        db.commit()
        
        return PatientReportResponse(
            id=report_id,
            patient_id=str(stage1.patient_id),
            report_type="stage1",
            report_title=report_content["report_title"],
            generated_at=report_content["generated_date"],
            download_url=f"/api/v1/reports/{report_id}/download",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating stage1 report: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report: {str(e)}"
        )


@router.post("/stage2", response_model=PatientReportResponse)
def generate_stage2_report(
    stage2_diagnostic_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Generate a downloadable Stage 2 diagnostic report."""
    
    try:
        # Retrieve stage 2 diagnostic
        stage2 = db.query(Stage2Diagnostic).filter(
            Stage2Diagnostic.id == stage2_diagnostic_id
        ).first()
        
        if not stage2:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stage 2 diagnostic not found"
            )
        
        # Safe field access with defaults
        evaluated_at = stage2.evaluated_at if stage2.evaluated_at else datetime.utcnow()
        severity_score = float(stage2.overall_severity_score) if stage2.overall_severity_score else 0.0
        patient = db.query(DBPatient).filter(DBPatient.id == stage2.patient_id).first()
        snapshot = stage2.input_snapshot if isinstance(stage2.input_snapshot, dict) else {}
        metabolomics = stage2.metabolomics if isinstance(stage2.metabolomics, dict) else {}
        disease_inputs = stage2.disease_specific_inputs if isinstance(stage2.disease_specific_inputs, dict) else {}

        lab_inputs = {
            "sFlt-1/PlGF ratio": snapshot.get("sflt1_plgf_ratio", stage2.sflt1_plgf_ratio),
            "Serum creatinine": snapshot.get("serum_creatinine", metabolomics.get("serum_creatinine")),
            "Platelet count": snapshot.get("platelet_count", disease_inputs.get("platelet_count")),
            "HbA1c": snapshot.get("hba1c", metabolomics.get("hba1c")),
            "OGTT 1hr": snapshot.get("ogtt_1hr", metabolomics.get("ogtt_1hr")),
            "OGTT 2hr": snapshot.get("ogtt_2hr", metabolomics.get("ogtt_2hr")),
            "Cervical length (mm)": snapshot.get("cervical_length_mm", stage2.cervical_length_mm),
            "fFN": snapshot.get("ffn_result", disease_inputs.get("ffn_result")),
            "Systolic BP": snapshot.get("systolic_bp", disease_inputs.get("systolic_bp")),
            "Diastolic BP": snapshot.get("diastolic_bp", disease_inputs.get("diastolic_bp")),
            "Blood sugar": snapshot.get("blood_sugar", metabolomics.get("blood_sugar")),
        }

        # Create report content with safe field access
        report_content = {
            "report_title": f"Stage 2 Diagnostic Report - {evaluated_at.strftime('%Y-%m-%d')}",
            "patient_id": str(stage2.patient_id),
            "patient_name": patient.full_name if patient else "Unknown Patient",
            "disease_checked": stage2.primary_disease_checked or "Not specified",
            "model_used": stage2.model_used or "differential_ensemble",
            "evaluated_date": evaluated_at.isoformat(),
            "gestational_age_weeks": stage2.gestational_age_weeks or 0,
            "overall_severity_score": severity_score,
            "dominant_condition": stage2.dominant_condition or "Not determined",
            "condition_probabilities": stage2.condition_probabilities or {},
            "cluster_profile": stage2.cluster_profile or {},
            "biomarkers": {
                "sFlt-1/PlGF ratio": float(stage2.sflt1_plgf_ratio) if stage2.sflt1_plgf_ratio else None,
                "PlGF absolute": float(stage2.plgf_absolute) if stage2.plgf_absolute else None,
                "PAPP-A": float(stage2.papp_a) if stage2.papp_a else None,
                "cervical_length": f"{float(stage2.cervical_length_mm)} mm" if stage2.cervical_length_mm else "Not recorded",
            },
            "lab_inputs": lab_inputs,
            "generated_date": datetime.utcnow().isoformat(),
            "generated_by": current_user.full_name or current_user.email,
        }
        
        # Save report to database
        report_id = str(uuid.uuid4())
        db_report = PatientReport(
            id=report_id,
            patient_id=str(stage2.patient_id),
            stage1_screening_id=str(stage2.stage1_screening_id) if stage2.stage1_screening_id else None,
            stage2_diagnostic_id=str(stage2.id),
            report_type="stage2",
            report_title=report_content["report_title"],
            content_type="pdf",
            report_content=report_content,
            generated_by=str(current_user.id),
        )
        db.add(db_report)
        db.commit()
        
        return PatientReportResponse(
            id=report_id,
            patient_id=str(stage2.patient_id),
            report_type="stage2",
            report_title=report_content["report_title"],
            generated_at=report_content["generated_date"],
            download_url=f"/api/v1/reports/{report_id}/download",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating stage2 report: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report: {str(e)}"
        )


@router.get("/{report_id}/download")
def download_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Download report as JSON or PDF."""
    
    try:
        # Retrieve report
        report = db.query(PatientReport).filter(
            PatientReport.id == report_id
        ).first()
        
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found"
            )
        
        # Check authorization (patient self, admin/specialist, or assigned frontline)
        ensure_patient_access(
            db, current_user, str(report.patient_id), action="report.download"
        )

        content = report.report_content if isinstance(report.report_content, dict) else {}
        pdf_bytes = _build_report_pdf(content, report.report_type or "stage2")
        filename = f"{report.report_type or 'clinical'}_report_{report_id}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading report: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download report: {str(e)}"
        )


@router.get("/patient/{patient_id}")
def list_patient_reports(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[PatientReportResponse]:
    """List all reports for a patient."""
    
    try:
        ensure_patient_access(
            db, current_user, str(patient_id), action="report.list"
        )
        
        # Retrieve reports
        reports = db.query(PatientReport).filter(
            cast(PatientReport.patient_id, String) == str(patient_id)
        ).order_by(PatientReport.generated_at.desc()).all()
        
        return [
            PatientReportResponse(
                id=report.id,
                patient_id=str(report.patient_id),
                report_type=report.report_type,
                report_title=report.report_title,
                generated_at=report.generated_at.isoformat() if report.generated_at else datetime.utcnow().isoformat(),
                download_url=f"/api/v1/reports/{report.id}/download",
                expires_at=report.expires_at.isoformat() if report.expires_at else None,
            )
            for report in reports
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing patient reports: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list reports: {str(e)}"
        )
