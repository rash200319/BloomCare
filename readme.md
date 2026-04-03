# BloomCare

BloomCare is an AI-powered maternal healthcare platform for screening, triage, appointments, longitudinal tracking, and role-based clinical workflows.

## What The Website Can Do

### Authentication And Onboarding
- Sign in as frontline staff, clinician, admin, or patient.
- Route users to the correct portal after login.
- Persist sessions across refreshes.
- Support national ID login for patients and email login for staff.
- Support first-login password setup for new accounts.
- Provide multilingual authentication UI in English, Sinhala, and Tamil.

### Frontline Staff Portal
- Search and register patients.
- Open patient profiles and view recent screening history.
- Record Stage 1 screening data.
- Capture vitals, pregnancy history, and risk factors.
- Run offline or online risk scoring.
- Save screenings locally when offline and sync later.
- Generate risk classification and escalation triggers.
- Print referral cards and screening summaries.
- Create appointments for patients.
- Choose specialization, specialist, date, and time slot.
- Add appointment notes.
- View appointment history and status.
- Receive notifications when doctors confirm, cancel, or complete appointments they created.
- Mark notifications as read.
- Edit profile settings.
- Switch between English, Sinhala, and Tamil.

### Doctor And Clinical Specialist Portal
- View escalated patients and patient histories.
- Review Stage 1 and Stage 2 screening results.
- Inspect risk scores, trend charts, and explainability details.
- Change appointment status to confirmed, completed, or cancelled.
- Record cancellation reasons and completion audit data.
- View today’s appointments and queue numbers.
- Filter appointments by status.
- Book appointments with specialist selection and availability lookup.
- Add notes during scheduling.
- View and manage patient prescriptions.
- Add prescriptions with dosage, frequency, route, and instructions.
- Generate and review clinical reports.
- Review differential diagnosis outputs.
- Read appointment notifications.
- Update profile settings.
- Use the portal in English, Sinhala, or Tamil.

### Patient Portal
- View pregnancy status and gestational tracking.
- See due date, trimester, and pregnancy countdown.
- Review screening results and vital sign trends.
- View screening history over time.
- Read AI explanations of screening results.
- See active and historical prescriptions.
- View appointments, confirmations, and cancellations.
- Read notification history and mark items as read.
- Access weekly pregnancy guidance and reminders.
- Update profile information and password.
- Use the portal in three languages.
- Continue using cached offline data when available.

### Admin Portal
- View analytics dashboards and KPIs.
- Track total screenings, high-risk cases, and clinic trends.
- Monitor referral efficiency and workload distribution.
- Review monthly screening trends and charts.
- Export monthly screening reports.
- View and manage staff accounts.
- Create new frontline staff and clinician accounts.
- Search, filter, and delete staff records.
- Edit admin profile settings.
- Switch between English, Sinhala, and Tamil.

### AI Assistant
- Answer questions about the platform.
- Help users navigate to the right portal or page.
- Guide users through features and workflows.
- Support multilingual chat interactions.

## Cross-Cutting Capabilities
- Offline-first screening workflow.
- Service worker and web app manifest support.
- Local queueing and reconnect sync.
- AI fallback inference when the backend is unavailable.
- Responsive layout across desktop and mobile.
- Role-based access control.
- Notification badges and read/unread filtering.
- Profile settings dialogs across portals.
- Appointment scheduling with time-slot selection.
- Longitudinal patient tracking.

## Project Structure

- `frontend/`: Next.js 16 and React 19 web application.
  - Frontline dashboard
  - Clinical dashboard
  - Admin dashboard
  - Patient portal
  - Login page
  - Appointment scheduling
  - Notifications panel
  - Chatbot assistant
  - Profile settings dialog
  - Trilingual support
- `backend/`: FastAPI and SQLAlchemy API.
- `models/`: Stage 1 and Stage 2 prediction models.
- `Data/`: Datasets used for training and reference.

## Getting Started

## Demo Deployment (AWS)

For demo purposes, BloomCare is deployed at:

- https://54.206.93.158

Important:
- This deployment is for demonstrations only.
- It is not secure and must not be used for production or real patient data.

### Frontend

1. Go to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000).

### Backend And Models

Install Python dependencies:
```bash
pip install -r requirements.txt
```


For detailed data mapping, see [DATA_DICTIONARY.md](./DATA_DICTIONARY.md).

---
© 2026 Hemas Hospitals Intelligence

