from fastapi import APIRouter, Depends, HTTPException, status, FileResponse
from typing import Any, Optional, Dict, List
from sqlalchemy.orm import Session
import logging
from datetime import datetime
import json
import uuid
from io import BytesIO

from core.deps import get_db, get_current_active_user
from schemas.screening import PatientReportRequest, PatientReportResponse, Stage1ScreeningReportData
from models.user import User
from models.screening import Stage1Screening, Stage2Diagnostic, PatientReport

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
        desc = factor_descriptions.get(factor, factor.replace("_", " ").title())
        importance_pct = round(importance * 100)
        descriptions.append(f"• {desc} ({importance_pct}%)")
    
    return descriptions


@router.post("/stage1", response_model=PatientReportResponse)
def generate_stage1_report(
    request: PatientReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Generate a downloadable Stage 1 screening report."""
    
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
    
    # Create report content
    report_content = {
        "report_title": request.title or f"Stage 1 Screening Report - {stage1.created_at.strftime('%Y-%m-%d')}",
        "patient_id": str(stage1.patient_id),
        "screening_date": stage1.collected_at.isoformat() if stage1.collected_at else stage1.synced_at.isoformat(),
        "gestational_age_weeks": stage1.gestational_age_weeks,
        "vitals": {
            "age": stage1.age,
            "blood_pressure": f"{stage1.systolic}/{stage1.diastolic} mmHg",
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
        patient_id=stage1.patient_id,
        stage1_screening_id=stage1.id,
        stage2_diagnostic_id=None,
        report_type="stage1",
        report_title=report_content["report_title"],
        content_type="json",
        report_content=report_content,
        generated_by=current_user.id,
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


@router.post("/stage2", response_model=PatientReportResponse)
def generate_stage2_report(
    stage2_diagnostic_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Generate a downloadable Stage 2 diagnostic report."""
    
    # Retrieve stage 2 diagnostic
    stage2 = db.query(Stage2Diagnostic).filter(
        Stage2Diagnostic.id == stage2_diagnostic_id
    ).first()
    
    if not stage2:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stage 2 diagnostic not found"
        )
    
    # Create report content
    report_content = {
        "report_title": f"Stage 2 Diagnostic Report - {stage2.evaluated_at.strftime('%Y-%m-%d')}",
        "patient_id": str(stage2.patient_id),
        "disease_checked": stage2.primary_disease_checked,
        "model_used": stage2.model_used,
        "evaluated_date": stage2.evaluated_at.isoformat(),
        "gestational_age_weeks": stage2.gestational_age_weeks,
        "overall_severity_score": float(stage2.overall_severity_score),
        "dominant_condition": stage2.dominant_condition,
        "condition_probabilities": stage2.condition_probabilities,
        "cluster_profile": stage2.cluster_profile,
        "biomarkers": {
            "sFlt-1/PlGF ratio": stage2.sflt1_plgf_ratio,
            "PlGF absolute": stage2.plgf_absolute,
            "PAPP-A": stage2.papp_a,
            "cervical_length": f"{stage2.cervical_length_mm} mm" if stage2.cervical_length_mm else "Not recorded",
        },
        "generated_date": datetime.utcnow().isoformat(),
        "generated_by": current_user.full_name or current_user.email,
    }
    
    # Save report to database
    report_id = str(uuid.uuid4())
    db_report = PatientReport(
        id=report_id,
        patient_id=stage2.patient_id,
        stage1_screening_id=stage2.stage1_screening_id,
        stage2_diagnostic_id=stage2.id,
        report_type="stage2",
        report_title=report_content["report_title"],
        content_type="json",
        report_content=report_content,
        generated_by=current_user.id,
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


@router.get("/{report_id}/download")
def download_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Download report as JSON or PDF."""
    
    # Retrieve report
    report = db.query(PatientReport).filter(
        PatientReport.id == report_id
    ).first()
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Check authorization
    if report.patient_id != current_user.id and current_user.role.value != "ADMIN":
        if current_user.role.value not in ["CLINICAL_SPECIALIST", "FRONTLINE_STAFF"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to download this report"
            )
    
    # Return as JSON for now (can be extended to PDF)
    json_content = json.dumps(report.report_content, indent=2)
    
    return FileResponse(
        content=json_content.encode(),
        media_type="application/json",
        filename=f"{report.report_type}_report_{report_id}.json"
    )


@router.get("/patient/{patient_id}")
def list_patient_reports(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[PatientReportResponse]:
    """List all reports for a patient."""
    
    # Check authorization
    if patient_id != current_user.id and current_user.role.value != "ADMIN":
        if current_user.role.value not in ["CLINICAL_SPECIALIST", "FRONTLINE_STAFF"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view these reports"
            )
    
    # Retrieve reports
    reports = db.query(PatientReport).filter(
        PatientReport.patient_id == patient_id
    ).order_by(PatientReport.generated_at.desc()).all()
    
    return [
        PatientReportResponse(
            id=report.id,
            patient_id=str(report.patient_id),
            report_type=report.report_type,
            report_title=report.report_title,
            generated_at=report.generated_at.isoformat(),
            download_url=f"/api/v1/reports/{report.id}/download",
            expires_at=report.expires_at.isoformat() if report.expires_at else None,
        )
        for report in reports
    ]
