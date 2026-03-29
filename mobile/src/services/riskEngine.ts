import { RiskResponse, Stage1VitalsInput } from '../types';
import { score as stage1Score } from './stage1_offline_ai';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

// Defaults support field-level imputation when community clinics have partial data.
export const DEFAULT_IMPUTE = {
  age: 28,
  systolic: 120,
  diastolic: 80,
  bmi: 24.5,
  heart_rate: 78,
  bs: 95,
  temperature: 36.8,
  hemoglobin: 12,
  pcos: 0,
  previous_complications: 0,
  preexisting_diabetes: 0,
  mental_health: 3,
  sleep_pattern: 7,
  exercise: 3,
  education: 4
};

export const calculateMap = (systolic: number, diastolic: number): number => (systolic + 2 * diastolic) / 3;

export const offlineStage1Risk = (vitals: Stage1VitalsInput): RiskResponse => {
  const map = vitals.map;

  const features = [
    vitals.age,
    vitals.bmi,
    vitals.systolic,
    vitals.diastolic,
    vitals.heart_rate,
    vitals.bs,
    vitals.temperature,
    vitals.hemoglobin,
    vitals.pcos,
    vitals.previous_complications,
    vitals.preexisting_diabetes,
    vitals.mental_health,
    vitals.education,
    map
  ];

  const modelOutput = stage1Score(features);
  const rawRisk = Number.isFinite(modelOutput[1]) ? modelOutput[1] : 0.5;

  const lifestyleAdjustment =
    (vitals.sleep_pattern < 5 ? 0.04 : vitals.sleep_pattern >= 7 ? -0.02 : 0) +
    (vitals.exercise <= 1 ? 0.03 : vitals.exercise >= 4 ? -0.01 : 0) +
    (vitals.mental_health >= 7 ? 0.05 : vitals.mental_health <= 3 ? -0.01 : 0);

  const riskScore = Number(clamp(rawRisk + lifestyleAdjustment, 0, 0.99).toFixed(2));
  const triggers = [];

  if (vitals.systolic >= 140 || vitals.diastolic >= 90) {
    triggers.push({
      feature: 'Blood Pressure',
      value: { systolic: vitals.systolic, diastolic: vitals.diastolic },
      clinical_reason: 'Hypertension detected',
      threshold: 'Systolic >= 140 or Diastolic >= 90 mmHg',
      severity_score: Number((((Math.max(vitals.systolic / 140, vitals.diastolic / 90)) - 1)).toFixed(4)),
    });
  }

  if (vitals.heart_rate > 100) {
    triggers.push({
      feature: 'Heart Rate',
      value: vitals.heart_rate,
      clinical_reason: 'Tachycardia detected',
      threshold: 'Heart Rate > 100 bpm',
      severity_score: Number(((vitals.heart_rate / 100) - 1).toFixed(4)),
    });
  }

  if (vitals.bs > 140) {
    triggers.push({
      feature: 'Blood Sugar',
      value: vitals.bs,
      clinical_reason: 'Elevated blood glucose detected',
      threshold: 'Blood Sugar > 140 mg/dL',
      severity_score: Number(((vitals.bs / 140) - 1).toFixed(4)),
    });
  }

  const isHighRisk =
    riskScore >= 0.5 ||
    vitals.systolic >= 140 ||
    vitals.diastolic >= 90 ||
    vitals.heart_rate > 100 ||
    triggers.length > 0;

  const bpStatus: RiskResponse['bp_status'] =
    vitals.systolic >= 140 || vitals.diastolic >= 90
      ? 'Elevated'
      : vitals.systolic >= 130 || vitals.diastolic >= 85
        ? 'Watch'
        : vitals.systolic < 90 || vitals.diastolic < 60
          ? 'Low'
          : 'Normal';

  const mapAlert = map >= 95 ? 'MAP high' : map >= 70 ? 'MAP normal' : 'MAP low';

  return {
    risk_level: isHighRisk ? 'high' : 'low',
    risk_score: riskScore,
    recommendations: isHighRisk
      ? [
          'Repeat BP within 15 minutes.',
          'Check heart rate again and evaluate for tachycardia symptoms.',
          'Escalate to Stage 2 specialist review.',
          'Request biomarker panel and obstetric consult.'
        ]
      : [
          'Continue routine maternal monitoring.',
          'Schedule next screening in 1-2 weeks.',
          'Promote hydration, nutrition, and BP self-checking.'
        ],
    bp_status: bpStatus,
    observation: `Offline Stage 1 estimate (${mapAlert}: ${map.toFixed(1)} mmHg)`,
    triggers,
    model_probability: riskScore,
  };
};
