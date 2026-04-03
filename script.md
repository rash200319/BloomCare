# BloomCare 5-Minute Technical Presentation Script

## 0:00-0:30 | Opening and Problem Statement
Good morning everyone. Today I am presenting BloomCare, an AI-powered maternal healthcare platform designed to support frontline screening, specialist decision support, and longitudinal care continuity.

Our objective is to detect high-risk pregnancy conditions earlier, especially preeclampsia, gestational diabetes, and preterm birth risk, while still functioning in low-connectivity settings.

The key technical design principle is an offline-first clinical workflow with synchronized, role-based web and mobile operations.

## 0:30-1:20 | Platform Architecture
BloomCare is organized into four major layers.

First, the frontend is a role-based Next.js web application with dedicated experiences for frontline staff, clinical specialists or obstetricians, admins, and patients.

Second, the mobile app supports frontline screening in disconnected environments, then queues and syncs records when connectivity is restored.

Third, the backend is a FastAPI service with SQLAlchemy and PostgreSQL, exposing endpoints for triage sync, patient management, appointments, differential evaluation, notifications, and analytics.

Fourth, the model layer contains trained PKL artifacts for Stage 2 risk estimation and differential outputs.

From a system perspective, BloomCare combines transactional healthcare workflows with ML inference and audit-ready persistence.

## 1:20-2:10 | Core Product Flows
The frontline workflow starts with patient verification and registration, followed by Stage 1 vitals capture and risk submission.

If the device is offline, records are persisted locally and marked for synchronization. On reconnect, queued actions are pushed to backend APIs.

The specialist workflow centers on escalated cases. Obstetricians review high-risk histories, run differential evaluation, inspect explainability outputs, and complete clinical decisions such as prescriptions and appointment actions.

The patient portal surfaces pregnancy progress, appointments, prescriptions, and historical risk trends. The admin portal provides KPIs, staff management, and operational visibility.

This gives us end-to-end continuity from community-level screening to specialist intervention.

## 2:10-3:45 | AI and Algorithm Pipeline
Now the AI core.

BloomCare currently uses a multi-model Stage 2 diagnostic strategy.

For condition-focused inference:
- `stage2_diagnostic.pkl` is used for preeclampsia-focused prediction.
- `stage2_gdm_diagnostic.pkl` is used for gestational diabetes prediction.
- `stage2_preterm_main_msf.pkl` is the main preterm birth model.
- `stage2_preterm_support_ehg.pkl` is the support preterm model fallback.

In specialist differential evaluation, the backend computes probabilities for preeclampsia, GDM, and preterm birth in parallel and selects a primary risk based on the highest calibrated probability.

For preterm specifically, the system runs the main model and conditionally blends support-model probability when informative signal exists. If support signal is unavailable, it safely falls back to main-model-only scoring.

This gives robustness while preserving deterministic behavior.

On explainability, BloomCare builds feature-level contributions using SHAP when available, and automatically falls back to model importance or local sensitivity estimation when SHAP is not available. This ensures interpretability continuity across deployment environments.

Risk outputs are normalized into clinical categories such as Low, Moderate, and High, then persisted with the diagnostic record for timeline tracking and audit.

## 3:45-4:35 | Reliability, Safety, and Data Integrity
From an engineering reliability perspective, the platform includes:
- Idempotent and conflict-aware sync behavior using payload hashing.
- Role-based authorization boundaries for specialist operations.
- Duplicate NIC handling in patient registration to prevent hard failures.
- Offline queue persistence and reconnect synchronization for resilience.
- Structured error handling to avoid blocking the full batch when a single payload is invalid.

These controls are essential in healthcare workflows where partial failures must be contained and recoverable.

## 4:35-5:00 | Closing and Value Proposition
To summarize, BloomCare combines offline-first maternal screening, role-based clinical workflows, and explainable AI diagnostics into one production-oriented platform.

The technical value is not only model prediction accuracy, but operational reliability: data continuity from edge to cloud, clinically interpretable outputs, and workflow integration for frontline-to-specialist escalation.

Thank you. I can now walk through a live demo of the specialist differential evaluation and preterm model behavior if needed.
