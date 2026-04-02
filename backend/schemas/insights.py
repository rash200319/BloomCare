"""
Schemas for health insights and analytics data
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, date


class WeeklyDevelopmentMetrics(BaseModel):
    """Metrics for development this week based on stage 1 screening data"""
    gestational_age_weeks: int
    estimated_length_cm: Optional[float] = None
    estimated_weight_g: Optional[float] = None
    development_percentage: Optional[float] = None
    development_milestone: Optional[str] = None
    
    model_config = {"from_attributes": True}


class VitalsSummary(BaseModel):
    """Summary of patient vitals this week"""
    avg_systolic: Optional[int] = None
    avg_diastolic: Optional[int] = None
    avg_heart_rate: Optional[int] = None
    avg_temperature: Optional[float] = None
    avg_bmi: Optional[float] = None
    avg_blood_sugar: Optional[float] = None
    avg_hemoglobin: Optional[float] = None


class ScreeningRiskSummary(BaseModel):
    """Risk classification summary from stage 1 screenings"""
    high_risk_count: int = 0
    routine_care_count: int = 0
    avg_risk_score: Optional[float] = None
    top_risk_factors: List[str] = []


class StressAndWellnessMetrics(BaseModel):
    """Psychological and wellness metrics"""
    avg_mental_health_score: Optional[float] = None
    avg_sleep_pattern_score: Optional[float] = None
    avg_exercise_score: Optional[float] = None
    wellness_trend: Optional[str] = None  # improving, stable, declining


class WeeklyDevelopmentInsight(BaseModel):
    """Complete weekly development insight for patient"""
    patient_id: str
    patient_name: str
    week: int
    date_range_start: date
    date_range_end: date
    
    # Development metrics
    development: WeeklyDevelopmentMetrics
    
    # Vitals
    vitals: VitalsSummary
    
    # Risk assessment
    risk_summary: ScreeningRiskSummary
    
    # Wellness
    wellness: StressAndWellnessMetrics
    
    # Number of screenings this week
    screening_count: int = 0
    
    # Development description
    development_description: str = ""
    
    # Last updated
    last_updated: Optional[datetime] = None


class InsightListResponse(BaseModel):
    """Response for list of insights"""
    insights: List[WeeklyDevelopmentInsight]
    total_count: int
    week_starting: date
    week_ending: date


class PatientWeeklyStats(BaseModel):
    """Simple stats for a patient for the current week"""
    patient_id: str
    patient_name: str
    screening_count: int
    avg_risk_score: Optional[float] = None
    highest_risk_classification: Optional[str] = None
    vital_readings_count: int = 0
