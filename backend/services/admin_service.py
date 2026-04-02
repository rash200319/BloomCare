"""
AdminService: Metric Aggregation & KPI Engine for BloomCare Admin Dashboard
Implements:
  1. Metric Aggregator Pattern (Top-row statistics)
  2. Time-Series Trends (Graphs & prevalence tracking)
  3. Hemas-specific KPIs (Referral efficiency, risk drivers, specialist workload)
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import logging
from decimal import Decimal

logger = logging.getLogger(__name__)


class AdminMetrics:
    """Aggregated metrics for dashboard top-row KPIs"""

    def __init__(
        self,
        total_screenings: int,
        stage1_screenings_count: int,
        stage2_screenings_count: int,
        high_risk_count: int,
        avg_severity_score: float,
        total_patients: int,
        active_clinics: int,
    ):
        self.total_screenings = total_screenings
        self.stage1_screenings_count = stage1_screenings_count
        self.stage2_screenings_count = stage2_screenings_count
        self.high_risk_count = high_risk_count
        self.avg_severity_score = avg_severity_score
        self.total_patients = total_patients
        self.active_clinics = active_clinics


class RiskDriverAggregate:
    """Aggregated risk driver across all explainability data"""

    def __init__(self, feature_name: str, frequency: int, avg_importance: float):
        self.feature_name = feature_name
        self.frequency = frequency
        self.avg_importance = avg_importance

    def percentage(self, total: int) -> float:
        """Calculate percentage of total high-risk cases"""
        return (self.frequency / total * 100) if total > 0 else 0.0


class TrendDataPoint:
    """Single data point for time-series visualization"""

    def __init__(
        self, timestamp: str, case_count: int, condition: str, severity_avg: float = 0.0
    ):
        self.timestamp = timestamp
        self.case_count = case_count
        self.condition = condition
        self.severity_avg = severity_avg


class SpecialistWorkload:
    """Per-specialist aggregated workload"""

    def __init__(
        self,
        specialist_id: str,
        specialist_name: str,
        case_count: int,
        primary_conditions: Dict[str, int],
        avg_severity: float,
    ):
        self.specialist_id = specialist_id
        self.specialist_name = specialist_name
        self.case_count = case_count
        self.primary_conditions = primary_conditions
        self.avg_severity = avg_severity


class AdminService:
    """Metrics aggregation engine for BloomCare admin dashboard"""

    @staticmethod
    def get_dashboard_metrics(db: Session) -> AdminMetrics:
        """
        📊 METRIC AGGREGATOR PATTERN
        Returns top-row dashboard statistics: Total Patients, High Risk, etc.
        """
        try:
            # Stage 1 screenings from stage1_screenings table
            stage1_screenings_count = db.execute(
                text("SELECT COUNT(*) FROM stage1_screenings WHERE collected_at IS NOT NULL")
            ).scalar() or 0

            # Stage 2 diagnostics from stage2_diagnostics table
            stage2_screenings_count = db.execute(
                text("SELECT COUNT(*) FROM stage2_diagnostics WHERE evaluated_at IS NOT NULL")
            ).scalar() or 0

            # Combined total screenings = Stage 1 + Stage 2
            total_screenings = int(stage1_screenings_count) + int(stage2_screenings_count)

            # High-risk count: edge_risk_classification = 'escalate'
            high_risk_count = db.execute(
                text("SELECT COUNT(*) FROM stage1_screenings WHERE edge_risk_classification = 'escalate'")
            ).scalar() or 0

            # Average severity score from stage1_screenings edge_risk_score field
            avg_severity = db.execute(
                text("SELECT COALESCE(AVG(edge_risk_score::numeric), 0.0) FROM stage1_screenings WHERE edge_risk_score IS NOT NULL")
            ).scalar() or 0.0

            # Total unique patients
            total_patients = db.execute(
                text("SELECT COUNT(DISTINCT id) FROM patients WHERE id IS NOT NULL")
            ).scalar() or 0

            # Active clinics (unique device_id from recent screenings)
            active_clinics = db.execute(
                text(
                    "SELECT COUNT(DISTINCT device_id) FROM stage1_screenings "
                    "WHERE collected_at > NOW() - INTERVAL '30 days' AND device_id IS NOT NULL"
                )
            ).scalar() or 0

            return AdminMetrics(
                total_screenings=int(total_screenings),
                stage1_screenings_count=int(stage1_screenings_count),
                stage2_screenings_count=int(stage2_screenings_count),
                high_risk_count=int(high_risk_count),
                avg_severity_score=float(avg_severity),
                total_patients=int(total_patients),
                active_clinics=int(active_clinics),
            )
        except Exception as e:
            logger.error(f"Error fetching dashboard metrics: {str(e)}", exc_info=True)
            return AdminMetrics(0, 0, 0, 0, 0.0, 0, 0)

    @staticmethod
    def get_case_trends(
        db: Session, days_back: int = 30, group_by: str = "day"
    ) -> List[TrendDataPoint]:
        """
        📈 TIME-SERIES TRENDS
        Returns case counts grouped by time bucket (day/week) from stage1_screenings and screening_reports.
        """
        try:
            # Determine time truncation
            if group_by == "week":
                date_trunc = "DATE_TRUNC('week', s1.collected_at)"
            else:
                date_trunc = "DATE_TRUNC('day', s1.collected_at)"

            query = text(
                f"""
                SELECT 
                    {date_trunc}::text AS day,
                    COUNT(DISTINCT s1.id) AS case_count,
                    COALESCE(sr.general_risk_flag, 'Unknown') AS condition,
                    COALESCE(AVG(CAST(s1.edge_risk_score AS numeric)), 0) AS severity_avg
                FROM stage1_screenings s1
                LEFT JOIN screening_reports sr ON s1.patient_id = sr.patient_id
                WHERE s1.collected_at > NOW() - INTERVAL '{days_back} days'
                GROUP BY {date_trunc}, sr.general_risk_flag
                ORDER BY day DESC
                """
            )

            results = db.execute(query).fetchall()
            return [
                TrendDataPoint(
                    timestamp=str(row[0]),
                    case_count=int(row[1]),
                    condition=str(row[2]),
                    severity_avg=float(row[3]),
                )
                for row in results
            ]
        except Exception as e:
            logger.error(f"Error fetching case trends: {str(e)}", exc_info=True)
            return []

    @staticmethod
    def get_top_risk_drivers(db: Session, limit: int = 5) -> List[RiskDriverAggregate]:
        """
        🏆 HEMAS KPI: Top Risk Drivers
        Analyzes stage1_screenings contributing_factors JSON to identify top risk reasons.
        """
        try:
            # Query stage1_screenings with high-risk cases
            # Extract triggers from contributing_factors JSON
            results = db.execute(
                text(
                    """
                    SELECT 
                        jsonb_array_elements(contributing_factors->'triggers')::text AS trigger_text,
                        COUNT(*) AS frequency,
                        AVG(CAST(edge_risk_score AS numeric)) AS importance
                    FROM stage1_screenings
                    WHERE contributing_factors IS NOT NULL 
                        AND edge_risk_classification = 'escalate'
                    GROUP BY trigger_text
                    ORDER BY frequency DESC, importance DESC
                    LIMIT :limit
                    """
                ),
                {"limit": limit},
            ).fetchall()

            return [
                RiskDriverAggregate(
                    feature_name=str(row[0]).strip('"'),
                    frequency=int(row[1]),
                    avg_importance=float(row[2]) if row[2] else 0.0,
                )
                for row in results
            ]
        except Exception as e:
            logger.warning(
                f"Error fetching top risk drivers with JSON: {str(e)}, using fallback..."
            )
            # Fallback: Return common field importance aggregates
            return AdminService._fallback_risk_drivers(db, limit)

    @staticmethod
    def _fallback_risk_drivers(db: Session, limit: int = 5) -> List[RiskDriverAggregate]:
        """
        Fallback risk driver aggregation using stage1_screenings direct fields.
        """
        try:
            drivers = []

            # BP-related drivers (systolic > 140 or diastolic > 90)
            bp_high = db.query(func.count()).from_statement(
                text(
                    "SELECT 1 FROM stage1_screenings WHERE (systolic > 140 OR diastolic > 90) AND edge_risk_classification = 'escalate'"
                )
            ).scalar() or 0
            if bp_high > 0:
                drivers.append(
                    RiskDriverAggregate(
                        feature_name="Elevated Blood Pressure",
                        frequency=bp_high,
                        avg_importance=0.35,
                    )
                )

            # BMI drivers (bmi > 30)
            bmi_high = db.query(func.count()).from_statement(
                text(
                    "SELECT 1 FROM stage1_screenings WHERE bmi > 30 AND edge_risk_classification = 'escalate'"
                )
            ).scalar() or 0
            if bmi_high > 0:
                drivers.append(
                    RiskDriverAggregate(
                        feature_name="High BMI",
                        frequency=bmi_high,
                        avg_importance=0.28,
                    )
                )

            # Blood sugar drivers (blood_sugar > 110)
            blood_sugar_high = db.query(func.count()).from_statement(
                text(
                    "SELECT 1 FROM stage1_screenings WHERE blood_sugar > 110 AND edge_risk_classification = 'escalate'"
                )
            ).scalar() or 0
            if blood_sugar_high > 0:
                drivers.append(
                    RiskDriverAggregate(
                        feature_name="Elevated Blood Sugar",
                        frequency=blood_sugar_high,
                        avg_importance=0.26,
                    )
                )

            # Low hemoglobin drivers (hemoglobin < 11)
            hemoglobin_low = db.query(func.count()).from_statement(
                text(
                    "SELECT 1 FROM stage1_screenings WHERE hemoglobin < 11 AND edge_risk_classification = 'escalate'"
                )
            ).scalar() or 0
            if hemoglobin_low > 0:
                drivers.append(
                    RiskDriverAggregate(
                        feature_name="Low Hemoglobin",
                        frequency=hemoglobin_low,
                        avg_importance=0.24,
                    )
                )

            # Age/PCOS drivers
            age_pcos_high = db.query(func.count()).from_statement(
                text(
                    "SELECT 1 FROM stage1_screenings WHERE (age > 35 OR pcos = TRUE) AND edge_risk_classification = 'escalate'"
                )
            ).scalar() or 0
            if age_pcos_high > 0:
                drivers.append(
                    RiskDriverAggregate(
                        feature_name="Age/PCOS Factor",
                        frequency=age_pcos_high,
                        avg_importance=0.22,
                    )
                )

            # Sort by frequency and return top N
            drivers.sort(key=lambda x: x.frequency, reverse=True)
            return drivers[:limit]
        except Exception as e:
            logger.error(f"Error in fallback risk drivers: {str(e)}", exc_info=True)
            return []

    @staticmethod
    def get_referral_efficiency(db: Session) -> Dict[str, Any]:
        """
        🏥 HEMAS KPI: Referral Efficiency
        Tracks the flow from Stage 1 (Community) → Stage 2 (Specialist).
        """
        try:
            # Total stage 1 high-risk screenings (eligible for referral)
            stage1_high_risk = db.execute(
                text("SELECT COUNT(*) FROM stage1_screenings WHERE edge_risk_classification = 'escalate'")
            ).scalar() or 0

            # Stage 2 recommendations (actual referrals completed)
            stage2_completed = db.execute(
                text("SELECT COUNT(*) FROM stage2_recommendations WHERE created_at IS NOT NULL")
            ).scalar() or 0

            # Conversion rate
            conversion_rate = (
                (stage2_completed / stage1_high_risk * 100) if stage1_high_risk > 0 else 0.0
            )

            # Average time to stage 2 (from stage1 date to stage2 date)
            avg_days_to_referral = db.execute(
                text(
                    """
                    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (s2r.created_at - s1.collected_at)) / 86400.0), 0.0)
                    FROM stage1_screenings s1
                    JOIN stage2_recommendations s2r ON s1.id = s2r.stage1_screening_id
                    WHERE s2r.created_at > s1.collected_at
                    """
                )
            ).scalar() or 0.0

            # Pending referrals
            pending = max(0, stage1_high_risk - stage2_completed)

            return {
                "stage1_high_risk_total": int(stage1_high_risk),
                "stage2_referrals_completed": int(stage2_completed),
                "conversion_rate_percent": round(conversion_rate, 2),
                "avg_days_to_referral": round(float(avg_days_to_referral), 1),
                "pending_referrals": int(pending),
            }
        except Exception as e:
            logger.error(f"Error fetching referral efficiency: {str(e)}", exc_info=True)
            return {
                "stage1_high_risk_total": 0,
                "stage2_referrals_completed": 0,
                "conversion_rate_percent": 0.0,
                "avg_days_to_referral": 0.0,
                "pending_referrals": 0,
            }

    @staticmethod
    def get_specialist_workload(db: Session) -> List[SpecialistWorkload]:
        """
        🏥 HEMAS KPI: Specialist Workload Distribution
        Aggregates stage2_recommendations by specialist to show workload.
        """
        try:
            # Get all specialists with their case counts
            query = text(
                """
                SELECT 
                    s2r.created_by AS specialist_id,
                    u.full_name AS specialist_name,
                    COUNT(s2r.id) AS case_count,
                    COALESCE(AVG(CAST(s1.edge_risk_score AS numeric)), 0.0) AS avg_severity
                FROM stage2_recommendations s2r
                JOIN users u ON s2r.created_by = u.id
                LEFT JOIN stage1_screenings s1 ON s2r.stage1_screening_id = s1.id
                WHERE s2r.created_by IS NOT NULL
                GROUP BY s2r.created_by, u.full_name
                ORDER BY case_count DESC
                """
            )

            results = db.execute(query).fetchall()
            workloads = []

            for row in results:
                specialist_id = str(row[0]) if row[0] else "Unknown"
                specialist_name = str(row[1]) if row[1] else "Unassigned"
                case_count = int(row[2])
                avg_severity = float(row[3])

                # Get breakdown of conditions (primary_disease_to_check) for this specialist
                conditions_query = text(
                    """
                    SELECT primary_disease_to_check, COUNT(*) AS count
                    FROM stage2_recommendations
                    WHERE created_by = :specialist_id
                    GROUP BY primary_disease_to_check
                    """
                )
                conditions_result = db.execute(
                    conditions_query, {"specialist_id": specialist_id}
                ).fetchall()
                primary_conditions = {
                    str(c[0]) if c[0] else "Unknown": int(c[1]) for c in conditions_result
                }

                workloads.append(
                    SpecialistWorkload(
                        specialist_id=specialist_id,
                        specialist_name=specialist_name,
                        case_count=case_count,
                        primary_conditions=primary_conditions,
                        avg_severity=avg_severity,
                    )
                )

            return workloads
        except Exception as e:
            logger.error(f"Error fetching specialist workload: {str(e)}", exc_info=True)
            return []

    @staticmethod
    def get_cost_impact_estimate(db: Session) -> Dict[str, Any]:
        """
        💰 HEMAS KPI: Cost Savings Estimate
        Estimates cost savings from early detection and prevention.
        Based on: (High-Risk Cases Detected) × (Average Cost Avoidance per Case)
        """
        try:
            # High-risk cases detected in Stage 1
            high_risk_detected = db.execute(
                text(
                    "SELECT COUNT(*) FROM stage1_screenings "
                    "WHERE edge_risk_classification = 'escalate' "
                    "AND collected_at > NOW() - INTERVAL '30 days'"
                )
            ).scalar() or 0

            # Assumption: Each early-detected high-risk case saves ~LKR 150,000 in ICU/complications
            cost_per_case_saved = 150000
            estimated_total_savings = high_risk_detected * cost_per_case_saved

            return {
                "high_risk_cases_detected_30d": int(high_risk_detected),
                "cost_per_case_saved_lkr": cost_per_case_saved,
                "estimated_total_savings_lkr": int(estimated_total_savings),
                "roi_percent": 250.0,  # Placeholder: Adjust based on actual program costs
            }
        except Exception as e:
            logger.error(f"Error fetching cost impact: {str(e)}", exc_info=True)
            return {
                "high_risk_cases_detected_30d": 0,
                "cost_per_case_saved_lkr": 150000,
                "estimated_total_savings_lkr": 0,
                "roi_percent": 0.0,
            }
