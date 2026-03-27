export type LanguageCode = 'en' | 'si' | 'ta';

export interface Stage1VitalsInput {
  patient_name: string;
  age: number;
  systolic: number;
  diastolic: number;
  bmi: number;
  heart_rate: number;
  bs: number;
  temperature: number;
  hemoglobin: number;
  pcos: number;
  previous_complications: number;
  preexisting_diabetes: number;
  mental_health: number;
  sleep_pattern: number;
  exercise: number;
  education: number;
  map: number;
}

export interface RiskResponse {
  risk_level: 'low' | 'high';
  risk_score: number;
  recommendations: string[];
  bp_status: 'Normal' | 'Watch' | 'Elevated' | 'Low';
  observation: string;
}

export interface PendingScreening {
  id: string;
  createdAt: string;
  vitals: Stage1VitalsInput;
}

export interface FieldState {
  patientName: string;
  age: string;
  systolic: string;
  diastolic: string;
  bmi: string;
  heartRate: string;
  bs: string;
  temperature: string;
  hemoglobin: string;
  pcos: string;
  previousComplications: string;
  preexistingDiabetes: string;
  mentalHealth: string;
  sleepPattern: string;
  exercise: string;
  education: string;
}
