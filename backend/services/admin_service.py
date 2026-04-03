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
import json
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


class Stage2DiagnosticDetail:
    """Human-readable stage 2 diagnostic row for table displays"""

    def __init__(
        self,
        diagnostic_id: str,
        evaluated_at: Optional[str],
        patient_name: str,
        patient_national_id: Optional[str],
        specialist_name: str,
        stage1_screening_id: Optional[str],
        primary_disease_checked: Optional[str],
        dominant_condition: Optional[str],
        overall_severity_score: Optional[float],
        sflt1_plgf_ratio: Optional[float],
        cervical_length_mm: Optional[float],
        model_used: Optional[str],
    ):
        self.diagnostic_id = diagnostic_id
        self.evaluated_at = evaluated_at
        self.patient_name = patient_name
        self.patient_national_id = patient_national_id
        self.specialist_name = specialist_name
        self.stage1_screening_id = stage1_screening_id
        self.primary_disease_checked = primary_disease_checked
        self.dominant_condition = dominant_condition
        self.overall_severity_score = overall_severity_score
        self.sflt1_plgf_ratio = sflt1_plgf_ratio
        self.cervical_length_mm = cervical_length_mm
        self.model_used = model_used


class AdminService:
    """Metrics aggregation engine for BloomCare admin dashboard"""

    @staticmethod
    def _extract_feature_importance(candidate: Any) -> float | None:
        if isinstance(candidate, (int, float, Decimal)):
            return float(candidate)
        if isinstance(candidate, dict):
            for key in ("importance", "score", "weight", "probability", "contribution"):
                value = candidate.get(key)
                if isinstance(value, (int, float, Decimal)):
                    return float(value)
        return None

    @staticmethod
    def _collect_feature_frequencies(payload: Any, accumulator: Dict[str, Dict[str, float]]) -> None:
        if payload is None:
            return

        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                return

        if isinstance(payload, list):
            for item in payload:
                AdminService._collect_feature_frequencies(item, accumulator)
            return

        if not isinstance(payload, dict):
            return

        for key, value in payload.items():
            feature_name = str(key).strip()
            if not feature_name:
                continue

            slot = accumulator.setdefault(feature_name, {"frequency": 0.0, "importance_sum": 0.0})
            slot["frequency"] += 1

            importance = AdminService._extract_feature_importance(value)
            if importance is not None:
                slot["importance_sum"] += max(0.0, importance)

            if isinstance(value, (dict, list)):
                AdminService._collect_feature_frequencies(value, accumulator)

    @staticmethod
    def get_dashboard_metrics(db: Session) -> AdminMetrics:
        """
        📊 METRIC AGGREGATOR PATTERN
        Returns top-row dashboard statistics: Total Patients, High Risk, etc.
        """
        try:
            total_screenings = db.execute(
                text("SELECT COUNT(*) FROM stage1_screenings")
            ).scalar() or 0

            high_risk_count = db.execute(
                text("SELECT COUNT(*) FROM screening_reports WHERE general_risk_flag = 'High'")
            ).scalar() or 0

            avg_severity = db.execute(
                text(
                    "SELECT COALESCE(AVG(overall_severity_score::numeric), 0.0) "
                    "FROM stage2_diagnostics WHERE overall_severity_score IS NOT NULL"
                )
            ).scalar() or 0.0

            total_patients = db.execute(text("SELECT COUNT(*) FROM patients")).scalar() or 0

            active_clinics = db.execute(
                text(
                    "SELECT COUNT(DISTINCT device_id) FROM stage1_screenings "
                    "WHERE device_id IS NOT NULL AND device_id <> ''"
                )
            ).scalar() or 0

            stage2_screenings_count = db.execute(
                text("SELECT COUNT(*) FROM stage2_diagnostics")
            ).scalar() or 0

            stage1_screenings_count = int(total_screenings)

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
                date_trunc = "DATE_TRUNC('week', collected_at)"
            else:
                date_trunc = "DATE_TRUNC('day', collected_at)"

            query = text(
                f"""
                SELECT 
                    {date_trunc}::text AS day,
                    COUNT(*) AS case_count,
                    COALESCE(AVG(CAST(edge_risk_score AS numeric)), 0) AS severity_avg
                FROM stage1_screenings
                WHERE collected_at >= NOW() - INTERVAL '{days_back} days'
                GROUP BY {date_trunc}
                ORDER BY {date_trunc} ASC
                """
            )

            results = db.execute(query).fetchall()
            return [
                TrendDataPoint(
                    timestamp=str(row[0]),
                    case_count=int(row[1]),
                    condition="All",
                    severity_avg=float(row[2]),
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
        Analyzes recent high-risk stage1 and stage2 JSON explainability payloads.
        """
        try:
            rows = db.execute(
                text(
                    """
                    SELECT s1.contributing_factors, s1.edge_risk_score, s2.explainability_data, s2.overall_severity_score
                    FROM stage1_screenings s1
                    LEFT JOIN stage2_diagnostics s2 ON s2.stage1_screening_id = s1.id
                    WHERE s1.edge_risk_classification = 'escalate'
                    ORDER BY s1.collected_at DESC NULLS LAST
                    LIMIT 100
                    """
                ),
            ).fetchall()

            aggregated: Dict[str, Dict[str, float]] = {}
            for contributing_factors, edge_risk_score, explainability_data, overall_severity_score in rows:
                AdminService._collect_feature_frequencies(contributing_factors, aggregated)
                AdminService._collect_feature_frequencies(explainability_data, aggregated)

                fallback_importance = None
                if isinstance(edge_risk_score, (int, float, Decimal)):
                    fallback_importance = float(edge_risk_score)
                elif isinstance(overall_severity_score, (int, float, Decimal)):
                    fallback_importance = float(overall_severity_score)

                if fallback_importance is not None:
                    for feature in list(aggregated.keys()):
                        if aggregated[feature]["importance_sum"] <= 0:
                            aggregated[feature]["importance_sum"] += fallback_importance

            aggregates: List[RiskDriverAggregate] = []
            for feature_name, values in aggregated.items():
                frequency = int(values["frequency"])
                if frequency <= 0:
                    continue
                aggregates.append(
                    RiskDriverAggregate(
                        feature_name=feature_name,
                        frequency=frequency,
                        avg_importance=float(values["importance_sum"]) / float(frequency),
                    )
                )

            aggregates.sort(key=lambda item: (item.frequency, item.avg_importance), reverse=True)
            return aggregates[:limit]
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
            drivers: List[RiskDriverAggregate] = []

            bmi_high = db.execute(
                text(
                    "SELECT COUNT(*) FROM stage1_screenings WHERE bmi > 30 AND edge_risk_classification = 'escalate'"
                )
            ).scalar() or 0
            if bmi_high > 0:
                drivers.append(
                    RiskDriverAggregate(
                        feature_name="Elevated BMI",
                        frequency=int(bmi_high),
                        avg_importance=0.28,
                    )
                )

            blood_sugar_high = db.execute(
                text(
                    "SELECT COUNT(*) FROM stage1_screenings WHERE blood_sugar > 110 AND edge_risk_classification = 'escalate'"
                )
            ).scalar() or 0
            if blood_sugar_high > 0:
                drivers.append(
                    RiskDriverAggregate(
                        feature_name="Elevated Blood Sugar",
                        frequency=int(blood_sugar_high),
                        avg_importance=0.26,
                    )
                )

            hemoglobin_low = db.execute(
                text(
                    "SELECT COUNT(*) FROM stage1_screenings WHERE hemoglobin < 11 AND edge_risk_classification = 'escalate'"
                )
            ).scalar() or 0
            if hemoglobin_low > 0:
                drivers.append(
                    RiskDriverAggregate(
                        feature_name="Low Hemoglobin",
                        frequency=int(hemoglobin_low),
                        avg_importance=0.24,
                    )
                )

            age_pcos_high = db.execute(
                text(
                    "SELECT COUNT(*) FROM stage1_screenings WHERE (age > 35 OR pcos = TRUE) AND edge_risk_classification = 'escalate'"
                )
            ).scalar() or 0
            if age_pcos_high > 0:
                drivers.append(
                    RiskDriverAggregate(
                        feature_name="Age/PCOS Factor",
                        frequency=int(age_pcos_high),
                        avg_importance=0.22,
                    )
                )

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
            stage1_high_risk = db.execute(
                text("SELECT COUNT(*) FROM stage1_screenings WHERE edge_risk_classification = 'escalate'")
            ).scalar() or 0

            stage2_completed = db.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM stage1_screenings s1
                    WHERE s1.edge_risk_classification = 'escalate'
                      AND EXISTS (
                          SELECT 1
                          FROM stage2_diagnostics s2
                          WHERE s2.stage1_screening_id = s1.id
                      )
                    """
                )
            ).scalar() or 0

            conversion_rate = (
                (stage2_completed / stage1_high_risk * 100) if stage1_high_risk > 0 else 0.0
            )

            avg_days_to_referral = db.execute(
                text(
                    """
                    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (s2.evaluated_at - s1.collected_at)) / 86400.0), 0.0)
                    FROM stage1_screenings s1
                    JOIN stage2_diagnostics s2 ON s2.stage1_screening_id = s1.id
                    WHERE s1.edge_risk_classification = 'escalate'
                      AND s2.evaluated_at IS NOT NULL
                      AND s1.collected_at IS NOT NULL
                    """
                )
            ).scalar() or 0.0

            pending = max(0, int(stage1_high_risk) - int(stage2_completed))

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
    def get_stage2_diagnostic_details(db: Session, limit: int = 10) -> List[Stage2DiagnosticDetail]:
        """
        Returns recent Stage 2 diagnostic rows with patient and specialist names for table display.
        """
        try:
            query = text(
                """
                SELECT
                    s2.id,
                    s2.evaluated_at,
                    COALESCE(p.full_name, 'Unknown Patient') AS patient_name,
                    p.national_id,
                    COALESCE(u.full_name, 'Unassigned') AS specialist_name,
                    s2.stage1_screening_id,
                    s2.primary_disease_checked,
                    s2.dominant_condition,
                    s2.overall_severity_score,
                    s2.sflt1_plgf_ratio,
                    s2.cervical_length_mm,
                    s2.model_used
                FROM stage2_diagnostics s2
                LEFT JOIN patients p ON p.id = s2.patient_id
                LEFT JOIN users u ON u.id = s2.specialist_id
                ORDER BY s2.evaluated_at DESC NULLS LAST
                LIMIT :limit
                """
            )

            rows = db.execute(query, {"limit": limit}).fetchall()
            return [
                Stage2DiagnosticDetail(
                    diagnostic_id=str(row[0]),
                    evaluated_at=row[1].isoformat() if row[1] else None,
                    patient_name=str(row[2]),
                    patient_national_id=str(row[3]) if row[3] else None,
                    specialist_name=str(row[4]),
                    stage1_screening_id=str(row[5]) if row[5] else None,
                    primary_disease_checked=str(row[6]) if row[6] else None,
                    dominant_condition=str(row[7]) if row[7] else None,
                    overall_severity_score=float(row[8]) if row[8] is not None else None,
                    sflt1_plgf_ratio=float(row[9]) if row[9] is not None else None,
                    cervical_length_mm=float(row[10]) if row[10] is not None else None,
                    model_used=str(row[11]) if row[11] else None,
                )
                for row in rows
            ]
        except Exception as e:
            logger.error(f"Error fetching stage2 diagnostic details: {str(e)}", exc_info=True)
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
