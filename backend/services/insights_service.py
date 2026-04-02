"""
Insights Service
Aggregates stage 1 screening data to provide weekly development insights
"""
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from fastapi import HTTPException, status
from decimal import Decimal

from backend.models.screening import Stage1Screening, RiskTier
from backend.models.patient import Patient
from backend.models.user import User
from backend.schemas.insights import (
    WeeklyDevelopmentInsight, WeeklyDevelopmentMetrics, VitalsSummary,
    ScreeningRiskSummary, StressAndWellnessMetrics, PatientWeeklyStats
)


class InsightsService:
    """Service for generating health insights from screening data"""
    
    # Development milestones by gestational age (in weeks)
    DEVELOPMENT_MILESTONES = {
        10: "Fetal development is underway. Major organs are forming.",
        11: "Heart is visible on ultrasound. Limbs are developing.",
        12: "Facial features starting to form. Critical organ development continues.",
        13: "Fingerprints are forming. Thyroid and vocal cords developing.",
        14: "Facial features becoming distinct. Ears and eyes more developed.",
        15: "Hair follicles forming. Skeletal structure hardening.",
        16: "Ears are fully formed. Eyes are more sensitive to light.",
        17: "Body is growing rapidly. Fetal movements becoming stronger.",
        18: "Hearing is developing. Eyes are working and moving.",
        19: "Lanugo (fine hair) covers the body. Vernix (protective coating) forming.",
        20: "Taste buds are developing. Fetal movements increasing.",
        21: "Lungs are developing air sacs. Brain development accelerating.",
        22: "Eyelids are more developed. Ears hearing sounds more clearly.",
        23: "Skin is becoming less transparent. Meconium forming in intestines.",
        24: "Lungs beginning to produce surfactant. Viability threshold reached.",
        25: "Neural connections in brain are multiplying rapidly.",
        26: "Eyes can open. Retinas are developing sensitivity to light.",
        27: "Brain is rapidly developing. Lungs nearly ready to breathe air.",
        28: "Brain surface convoluting. Fetal position becoming head-down.",
        29: "Bones are hardening. Baby practicing breathing movements.",
        30: "Face is fully formed. Skin becoming smoothers as fat develops.",
        31: "Vernix thick and creamy. Brain size increasing significantly.",
        32: "Pupils can dilate and constrict. Most organs mature enough for birth.",
        33: "Most systems ready for birth. Rapid growth continuing.",
        34: "Lungs nearly fully developed. Positioning for delivery.",
        35: "Bones mostly hardened. Most reflexes present for survival.",
        36: "Baby dropping lower into pelvis. Most systems fully developed.",
        37: "Considered full-term. Ready for delivery.",
        38: "All systems mature and ready. Waiting for labor.",
        39: "Full-term pregnancy. Optimal time for delivery.",
        40: "Full-term. Baby ready to meet the world!"
    }
    
    @staticmethod
    def get_this_week_dates() -> tuple[date, date]:
        """Get start and end dates of current week (Monday to Sunday)"""
        today = date.today()
        monday = today - timedelta(days=today.weekday())
        sunday = monday + timedelta(days=6)
        return monday, sunday
    
    @staticmethod
    def estimate_fetal_size(gestational_weeks: int) -> tuple[float, float]:
        """
        Estimate fetal length (cm) and weight (grams) based on gestational age.
        Uses standard fetal growth charts.
        """
        # Approximate values based on standard fetal growth charts
        size_chart = {
            10: (3.1, 4),
            11: (4.1, 7),
            12: (5.4, 14),
            13: (7.0, 23),
            14: (8.7, 43),
            15: (10.1, 70),
            16: (11.6, 100),
            17: (13.0, 140),
            18: (14.2, 190),
            19: (15.3, 240),
            20: (16.4, 300),
            21: (27.0, 360),
            22: (27.8, 430),
            23: (28.9, 501),
            24: (30.0, 600),
            25: (34.6, 660),
            26: (35.3, 760),
            27: (36.6, 875),
            28: (37.6, 1005),
            29: (38.6, 1153),
            30: (39.9, 1319),
            31: (41.1, 1502),
            32: (42.8, 1702),
            33: (43.7, 1918),
            34: (45.0, 2146),
            35: (46.2, 2383),
            36: (47.4, 2622),
            37: (48.4, 2859),
            38: (49.2, 3083),
            39: (49.9, 3288),
            40: (50.7, 3462)
        }
        
        if gestational_weeks in size_chart:
            return size_chart[gestational_weeks]
        
        # Linear interpolation for non-standard weeks
        if gestational_weeks < 10:
            return 3.1, 4
        if gestational_weeks > 40:
            return 50.7, 3462
        
        lower = max([w for w in size_chart.keys() if w < gestational_weeks])
        upper = min([w for w in size_chart.keys() if w > gestational_weeks])
        
        l1, w1 = size_chart[lower]
        l2, w2 = size_chart[upper]
        
        fraction = (gestational_weeks - lower) / (upper - lower)
        length = l1 + (l2 - l1) * fraction
        weight = w1 + (w2 - w1) * fraction
        
        return round(length, 1), round(weight, 0)
    
    @staticmethod
    def calculate_development_percentage(gestational_weeks: int) -> float:
        """Calculate percentage of pregnancy completed"""
        # Normal pregnancy is 40 weeks
        percentage = min((gestational_weeks / 40) * 100, 100)
        return round(percentage, 1)
    
    @staticmethod
    def get_development_milestone(gestational_weeks: int) -> str:
        """Get development description for gestational age"""
        if gestational_weeks in InsightsService.DEVELOPMENT_MILESTONES:
            return InsightsService.DEVELOPMENT_MILESTONES[gestational_weeks]
        
        # Find closest milestone
        weeks = sorted(InsightsService.DEVELOPMENT_MILESTONES.keys())
        if gestational_weeks < weeks[0]:
            return InsightsService.DEVELOPMENT_MILESTONES[weeks[0]]
        if gestational_weeks > weeks[-1]:
            return InsightsService.DEVELOPMENT_MILESTONES[weeks[-1]]
        
        # Find surrounding weeks
        for i, w in enumerate(weeks):
            if w > gestational_weeks:
                return InsightsService.DEVELOPMENT_MILESTONES[weeks[i-1]]
        
        return InsightsService.DEVELOPMENT_MILESTONES[weeks[-1]]
    
    @staticmethod
    def get_patient_weekly_insight(
        db: Session,
        patient_id: str
    ) -> WeeklyDevelopmentInsight:
        """Get weekly development insight for a specific patient"""
        
        # Verify patient exists
        patient = db.query(Patient).filter(Patient.user_id == patient_id).first()
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Patient with ID '{patient_id}' not found"
            )
        
        # Get this week's date range
        monday, sunday = InsightsService.get_this_week_dates()
        
        # Get all stage 1 screenings for this patient this week
        screenings = db.query(Stage1Screening).filter(
            and_(
                Stage1Screening.patient_id == patient.id,
                Stage1Screening.collected_at >= datetime.combine(monday, datetime.min.time()),
                Stage1Screening.collected_at <= datetime.combine(sunday, datetime.max.time())
            )
        ).all()
        
        # Calculate metrics from screenings
        if not screenings:
            # Return empty insight if no screenings
            return WeeklyDevelopmentInsight(
                patient_id=patient_id,
                patient_name=patient.full_name,
                week=-1,  # No data
                date_range_start=monday,
                date_range_end=sunday,
                development=WeeklyDevelopmentMetrics(
                    gestational_age_weeks=0,
                    estimated_length_cm=None,
                    estimated_weight_g=None,
                    development_percentage=0,
                    development_milestone="No screening data available"
                ),
                vitals=VitalsSummary(),
                risk_summary=ScreeningRiskSummary(),
                wellness=StressAndWellnessMetrics(),
                screening_count=0,
                development_description="No screening data available",
                last_updated=None
            )
        
        # Get the latest gestational age
        latest_screening = screenings[-1]  # Most recent
        gestational_weeks = latest_screening.gestational_age_weeks or 0
        
        # Calculate vitals averages
        vitals_data = VitalsSummary(
            avg_systolic=int(sum(s.systolic for s in screenings if s.systolic) / len([s for s in screenings if s.systolic])) if any(s.systolic for s in screenings) else None,
            avg_diastolic=int(sum(s.diastolic for s in screenings if s.diastolic) / len([s for s in screenings if s.diastolic])) if any(s.diastolic for s in screenings) else None,
            avg_heart_rate=int(sum(s.heart_rate for s in screenings if s.heart_rate) / len([s for s in screenings if s.heart_rate])) if any(s.heart_rate for s in screenings) else None,
            avg_temperature=float(sum(s.temperature for s in screenings if s.temperature) / len([s for s in screenings if s.temperature])) if any(s.temperature for s in screenings) else None,
            avg_bmi=float(sum(s.bmi for s in screenings if s.bmi) / len([s for s in screenings if s.bmi])) if any(s.bmi for s in screenings) else None,
            avg_blood_sugar=float(sum(s.blood_sugar for s in screenings if s.blood_sugar) / len([s for s in screenings if s.blood_sugar])) if any(s.blood_sugar for s in screenings) else None,
            avg_hemoglobin=float(sum(s.hemoglobin for s in screenings if s.hemoglobin) / len([s for s in screenings if s.hemoglobin])) if any(s.hemoglobin for s in screenings) else None
        )
        
        # Calculate risk summary
        high_risk = sum(1 for s in screenings if s.edge_risk_classification == RiskTier.escalate)
        routine_care = sum(1 for s in screenings if s.edge_risk_classification == RiskTier.routine_care)
        
        risk_scores = [float(s.edge_risk_score) for s in screenings if s.edge_risk_score]
        avg_risk_score = sum(risk_scores) / len(risk_scores) if risk_scores else None
        
        # Extract top risk factors from contributing_factors JSONB
        risk_factors = set()
        for screening in screenings:
            if screening.contributing_factors:
                for factor in screening.contributing_factors.keys():
                    risk_factors.add(factor)
        
        risk_summary = ScreeningRiskSummary(
            high_risk_count=high_risk,
            routine_care_count=routine_care,
            avg_risk_score=avg_risk_score,
            top_risk_factors=sorted(list(risk_factors))[:5]
        )
        
        # Calculate wellness metrics
        mental_health_scores = [s.mental_health for s in screenings if s.mental_health is not None]
        sleep_scores = [s.sleep_pattern for s in screenings if s.sleep_pattern is not None]
        exercise_scores = [s.exercise for s in screenings if s.exercise is not None]
        
        wellness = StressAndWellnessMetrics(
            avg_mental_health_score=sum(mental_health_scores) / len(mental_health_scores) if mental_health_scores else None,
            avg_sleep_pattern_score=sum(sleep_scores) / len(sleep_scores) if sleep_scores else None,
            avg_exercise_score=sum(exercise_scores) / len(exercise_scores) if exercise_scores else None
        )
        
        # Estimate fetal size
        length, weight = InsightsService.estimate_fetal_size(gestational_weeks)
        development_percentage = InsightsService.calculate_development_percentage(gestational_weeks)
        
        development_metrics = WeeklyDevelopmentMetrics(
            gestational_age_weeks=gestational_weeks,
            estimated_length_cm=length,
            estimated_weight_g=weight,
            development_percentage=development_percentage,
            development_milestone=InsightsService.get_development_milestone(gestational_weeks)
        )
        
        # Build complete insight
        insight = WeeklyDevelopmentInsight(
            patient_id=patient_id,
            patient_name=patient.full_name,
            week=gestational_weeks,
            date_range_start=monday,
            date_range_end=sunday,
            development=development_metrics,
            vitals=vitals_data,
            risk_summary=risk_summary,
            wellness=wellness,
            screening_count=len(screenings),
            development_description=InsightsService.get_development_milestone(gestational_weeks),
            last_updated=latest_screening.synced_at or latest_screening.collected_at
        )
        
        return insight
    
    @staticmethod
    def get_all_patients_weekly_insights(
        db: Session
    ) -> list[WeeklyDevelopmentInsight]:
        """Get weekly insights for all patients with screening data"""
        
        monday, sunday = InsightsService.get_this_week_dates()
        
        # Get all patients that have screenings this week
        patients_with_screenings = db.query(Patient.user_id, Patient.full_name).join(
            Stage1Screening,
            Patient.id == Stage1Screening.patient_id
        ).filter(
            and_(
                Stage1Screening.collected_at >= datetime.combine(monday, datetime.min.time()),
                Stage1Screening.collected_at <= datetime.combine(sunday, datetime.max.time())
            )
        ).distinct().all()
        
        insights = []
        for patient_user_id, _ in patients_with_screenings:
            try:
                insight = InsightsService.get_patient_weekly_insight(db, patient_user_id)
                insights.append(insight)
            except:
                continue
        
        return insights
    
    @staticmethod
    def get_patient_weekly_stats(
        db: Session,
        patient_id: str
    ) -> PatientWeeklyStats:
        """Get quick stats for a patient this week"""
        
        # Verify patient exists
        patient = db.query(Patient).filter(Patient.user_id == patient_id).first()
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Patient with ID '{patient_id}' not found"
            )
        
        monday, sunday = InsightsService.get_this_week_dates()
        
        # Get screenings this week
        screenings = db.query(Stage1Screening).filter(
            and_(
                Stage1Screening.patient_id == patient.id,
                Stage1Screening.collected_at >= datetime.combine(monday, datetime.min.time()),
                Stage1Screening.collected_at <= datetime.combine(sunday, datetime.max.time())
            )
        ).all()
        
        # Count vital readings
        vital_readings = sum(1 for s in screenings if any([s.systolic, s.diastolic, s.heart_rate]))
        
        # Get risk info
        risk_scores = [float(s.edge_risk_score) for s in screenings if s.edge_risk_score]
        avg_risk = sum(risk_scores) / len(risk_scores) if risk_scores else None
        
        # Highest risk classification
        high_risk_count = sum(1 for s in screenings if s.edge_risk_classification == RiskTier.escalate)
        highest_risk = "escalate" if high_risk_count > 0 else "routine_care"
        
        return PatientWeeklyStats(
            patient_id=patient_id,
            patient_name=patient.full_name,
            screening_count=len(screenings),
            avg_risk_score=avg_risk,
            highest_risk_classification=highest_risk if screenings else None,
            vital_readings_count=vital_readings
        )
