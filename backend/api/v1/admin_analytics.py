"""
Admin Analytics API Endpoints
Exposes AdminService metrics for the admin dashboard.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, List
import logging

from core.deps import get_db, get_current_active_user
from models.user import User
from services.admin_service import (
    AdminService,
    AdminMetrics,
    TrendDataPoint,
    RiskDriverAggregate,
    SpecialistWorkload,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class MetricsResponse(Dict[str, Any]):
    """Dashboard metrics response wrapper"""

    pass


@router.get("/dashboard-metrics")
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """
    📊 Dashboard Top-Row Metrics
    Returns aggregated KPIs for admin dashboard top row.
    
    Authorized: ADMIN, CLINICAL_SPECIALIST
    """
    if current_user.role.value not in ["ADMIN", "CLINICAL_SPECIALIST"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and specialists can access dashboard metrics",
        )

    metrics = AdminService.get_dashboard_metrics(db)

    return {
        "total_screenings": metrics.total_screenings,
        "stage1_screenings_count": metrics.stage1_screenings_count,
        "stage2_screenings_count": metrics.stage2_screenings_count,
        "high_risk_count": metrics.high_risk_count,
        "avg_severity_score": round(metrics.avg_severity_score, 3),
        "total_patients": metrics.total_patients,
        "active_clinics": metrics.active_clinics,
    }


@router.get("/case-trends")
def get_case_trends(
    days_back: int = 30,
    group_by: str = "day",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """
    📈 Case Trends Over Time
    Returns time-series data for "Cases over Time" and "Prevalence by Condition" charts.
    
    Query params:
      - days_back: Number of days to look back (default 30)
      - group_by: 'day' or 'week' for aggregation granularity
    
    Authorized: ADMIN, CLINICAL_SPECIALIST
    """
    if current_user.role.value not in ["ADMIN", "CLINICAL_SPECIALIST"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and specialists can access trend data",
        )

    if group_by not in ["day", "week"]:
        group_by = "day"

    trends = AdminService.get_case_trends(db, days_back=days_back, group_by=group_by)

    return {
        "period_days": days_back,
        "granularity": group_by,
        "total_cases": sum(t.case_count for t in trends),
        "trends": [
            {
                "timestamp": t.timestamp,
                "case_count": t.case_count,
                "condition": t.condition,
                "severity_avg": round(t.severity_avg, 3),
            }
            for t in trends
        ],
    }


@router.get("/top-risk-drivers")
def get_top_risk_drivers(
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """
    🏆 Top Risk Drivers
    Returns the top reasons patients are flagged as high-risk.
    Example: "40% due to BP, 30% due to BMI, 20% due to Age..."
    
    Authorized: ADMIN, CLINICAL_SPECIALIST
    """
    if current_user.role.value not in ["ADMIN", "CLINICAL_SPECIALIST"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and specialists can access risk driver analysis",
        )

    drivers = AdminService.get_top_risk_drivers(db, limit=limit)
    high_risk_count = AdminService.get_dashboard_metrics(db).high_risk_count

    return {
        "limit": limit,
        "high_risk_total": high_risk_count,
        "drivers": [
            {
                "feature": d.feature_name,
                "frequency": d.frequency,
                "percentage": round(d.percentage(high_risk_count), 1),
                "avg_importance": round(d.avg_importance, 3),
            }
            for d in drivers
        ],
    }


@router.get("/referral-efficiency")
def get_referral_efficiency(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """
    🏥 Referral Efficiency KPI
    Tracks flow from Stage 1 (Community) → Stage 2 (Specialist).
    Returns conversion rates, days to referral, and pending cases.
    
    Authorized: ADMIN, CLINICAL_SPECIALIST
    """
    if current_user.role.value not in ["ADMIN", "CLINICAL_SPECIALIST"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and specialists can access referral metrics",
        )

    efficiency = AdminService.get_referral_efficiency(db)
    return efficiency


@router.get("/specialist-workload")
def get_specialist_workload(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """
    👨‍⚕️ Specialist Workload Distribution
    Shows case counts, primary conditions, and severity metrics per specialist.
    Used for load-balancing and capacity planning.
    
    Authorized: ADMIN, CLINICAL_SPECIALIST
    """
    if current_user.role.value not in ["ADMIN", "CLINICAL_SPECIALIST"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and specialists can access workload data",
        )

    workloads = AdminService.get_specialist_workload(db)

    return {
        "total_specialists": len(workloads),
        "specialists": [
            {
                "specialist_id": w.specialist_id,
                "specialist_name": w.specialist_name,
                "case_count": w.case_count,
                "primary_conditions": w.primary_conditions,
                "avg_severity": round(w.avg_severity, 3),
            }
            for w in workloads
        ],
    }


@router.get("/cost-impact")
def get_cost_impact(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """
    💰 Cost Impact & ROI Estimate
    Returns estimated cost savings from early detection and AI optimization.
    Shows prevented cases, cost per case avoided, and total program ROI.
    
    Authorized: ADMIN only
    """
    if current_user.role.value != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can access cost impact metrics",
        )

    impact = AdminService.get_cost_impact_estimate(db)
    return impact
