 BloomCare 🌸

BloomCare is an AI-powered maternity care intelligence platform designed to improve maternal health outcomes through advanced predictive diagnostics and role-based monitoring dashboards.

## 🏗️ Project Structure

The project is divided into two main sections:

- **`frontend/`**: A modern Next.js 16 (React 19) application featuring:
  - **Frontline Dashboard**: For clinical staff and field workers.
  - **Clinical Dashboard**: For obstetricians with Explainable AI (XAI) insights.
  - **Admin Dashboard**: For hospital management and analytics.
  - **Patient Portal**: For expectant mothers to track their journey.
  - **Trilingual Support**: English (EN), Sinhala (SI), and Tamil (TA).
- **`models/`**: Predictive machine learning models (Stage 1 & Stage 2) for:
  - Preeclampsia Risk
  - Gestational Diabetes (GDM)
  - Preterm Birth
- **`Data/`**: Datasets used for model training and reference.

## 🚀 Getting Started

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
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

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
