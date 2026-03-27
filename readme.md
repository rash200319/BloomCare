 BloomCare 

BloomCare is an AI-powered maternity care intelligence platform designed to improve maternal health outcomes through advanced predictive diagnostics and role-based monitoring dashboards.

##  Project Structure

currently

- **`frontend/`**: A modern Next.js 16 (React 19) application featuring:
  - **Frontline Dashboard**
  - **Clinical Dashboard**
  - **Admin Dashboard**
  - **Patient Portal**
  - **Trilingual Support**
- **`models/`**: Predictive machine learning models (Stage 1 & Stage 2) for:
  - Preeclampsia Risk
  - Gestational Diabetes (GDM)
  - Preterm Birth
- **`Data/`**: Datasets used for model training and reference.

##  Getting Started

### Frontend (User Interface)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   # or
   pnpm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.(currently on local host)

### Backend & Models

The models are implemented in Python. Ensure you have the required dependencies installed:
```bash
pip install -r requirements.txt
```

## 📊 Model Performance Highlights

- **GDM Stage 2**: 0.9983 ROC-AUC
- **Preterm Stage 2**: 0.9911 ROC-AUC
- **Preeclampsia Stage 2**: 0.9749 ROC-AUC

For detailed data mapping, see [DATA_DICTIONARY.md](./DATA_DICTIONARY.md).

---
© 2026 Hemas Hospitals Intelligence

## Recent Work Added (March 2026)

The following updates were implemented in this project:

- Added offline-first Stage 1 flow for the frontline triage experience.
- Integrated a service worker and web app manifest for PWA-style offline support.
- Added local queueing of screenings with reconnect sync behavior.
- Wired offline AI inference using stage1_offline_ai.js fallback when backend is unavailable.
- Improved responsive behavior across key screens (frontline workspace and patient portal).
- Updated Stage 1 inputs to the Golden Features set:
   - Age, BMI, Systolic_BP, Diastolic, Heart_Rate, BS, Body_Temp, Hemoglobin,
      PCOS, Previous_Complications, Preexisting_Diabetes, Mental_Health,
      Sleep_Pattern, Exercise, Education.
- Added automatic Mean Arterial Pressure (MAP) calculation and display:
   - MAP = (Systolic_BP + 2 x Diastolic) / 3.
- Added imputation-style defaults for unknown values in frontend payload creation.

