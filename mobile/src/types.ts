export type LanguageCode = 'en' | 'si' | 'ta';
export type UserRole = 'frontline_staff' | 'patient' | 'clinical_specialist' | 'admin';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  pin: string; // PIN for offline login after initial registration
}

export interface PinLoginCredentials {
  pin: string; // 4-6 digit PIN for offline login
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isOffline: boolean;
  hasStoredSession: boolean;
}

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

export interface ClinicalTrigger {
  feature: string;
  value: number | Record<string, number>;
  clinical_reason: string;
  threshold: string;
  severity_score: number;
}

export interface RiskResponse {
  risk_level: 'low' | 'high';
  risk_score: number;
  recommendations: string[];
  bp_status: 'Normal' | 'Watch' | 'Elevated' | 'Low';
  observation: string;
  triggers?: ClinicalTrigger[];
  model_probability?: number;
}

export interface PendingScreening {
  id: string;
  createdAt: string;
  vitals: Stage1VitalsInput;
  riskScore?: number;
  riskLevel?: 'low' | 'high';
  recommendations?: string[];
  userId?: string;
  is_synced?: boolean;
  patient_id?: string;
  updatedAt?: string;
}

export interface PatientMiniProfile {
  patient_id: string;
  national_id?: string;
  patient_name: string;
  age?: number;
  gestation_weeks?: number;
  risk_level?: 'low' | 'high';
  last_screening_at?: string;
  history_note?: string;
}

export interface LocalPatientSnapshot {
  patient_id: string;
  patient_name: string;
  mini_profile: PatientMiniProfile;
  stage1_history: PendingScreening[];
}

export interface DirtyVitalsUpdate {
  local_id: string;
  patient_id: string;
  patient_name: string;
  vitals: Stage1VitalsInput;
  risk_score: number;
  risk_level: 'low' | 'high';
  recommendations: string[];
  created_at: string;
  updated_at: string;
  is_synced: boolean;
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
