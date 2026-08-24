"""
Insights API Router
Endpoints for retrieving health insights from stage 1 screening data
"""
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.core.deps import get_db, get_current_user, can_access_patient
from backend.models.user import User, UserRole
from backend.models.patient import Patient
from backend.schemas.insights import (
    WeeklyDevelopmentInsight, PatientWeeklyStats, InsightListResponse
)
from backend.services.insights_service import InsightsService
from datetime import date


router = APIRouter()


@router.get(
    "/patient/{patient_id}/this-week",
    response_model=WeeklyDevelopmentInsight,
    summary="Get Patient Weekly Development Insight",
    description="Get development insight for a patient based on stage 1 screenings this week"
)
def get_patient_weekly_insight(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Get comprehensive weekly development insight for a patient.
    
    **Parameters:**
    - **patient_id**: Patient primary key
    
    **Returns:**
    - Development metrics (gestational age, estimated size, development %)
    - Vitals summary (averaged from all screenings this week)
    - Risk assessment (high risk count, risk factors)
    - Wellness metrics (mental health, sleep, exercise scores)
    - Development description and milestone
    
    **Access:**
    - Patients can only view their own weekly insight
    - Clinical specialists, admins, and staff can view any patient's insight
    """
    if not can_access_patient(db, current_user, patient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view patient insights"
        )
    
    return InsightsService.get_patient_weekly_insight(db, patient_id)


@router.get(
    "/patient/{patient_id}/stats",
    response_model=PatientWeeklyStats,
    summary="Get Patient Weekly Quick Stats",
    description="Get quick stats for a patient this week"
)
def get_patient_weekly_stats(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Get quick statistics for a patient this week.
    
    **Parameters:**
    - **patient_id**: Patient primary key
    
    **Returns:**
    - Number of screenings this week
    - Average risk score
    - Highest risk classification
    - Vital readings count
    
    **Access:**
    - Patients can only view their own stats
    - Clinical specialists, admins, and staff can view any patient's stats
    """
    if not can_access_patient(db, current_user, patient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view patient stats"
        )
    
    return InsightsService.get_patient_weekly_stats(db, patient_id)


@router.get(
    "/this-week",
    response_model=InsightListResponse,
    summary="Get All Patients Weekly Insights",
    description="Get weekly insights for all patients with screening data (staff/admin only)"
)
def get_all_patients_weekly_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Get weekly development insights for all patients with screening data this week.
    
    **Returns:**
    - List of patient weekly insights
    - Total count of patients
    - Week date range
    
    **Access:**
    - Only clinical specialists, admins, and frontline staff can view all insights
    """
    # Only staff and admins can view all insights
    if current_user.role not in [UserRole.CLINICAL_SPECIALIST, UserRole.ADMIN, UserRole.FRONTLINE_STAFF]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view all patient insights"
        )
    
    insights = InsightsService.get_all_patients_weekly_insights(db)
    
    monday, sunday = InsightsService.get_this_week_dates()
    
    return InsightListResponse(
        insights=insights,
        total_count=len(insights),
        week_starting=monday,
        week_ending=sunday
    )
