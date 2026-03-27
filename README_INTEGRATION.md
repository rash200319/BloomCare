# BloomCare AI Maternal Health Triage System

This application integrates the new `stage1_general_screener.pkl` model with a modern web frontend for real-time maternal health risk assessment.

## Quick Start

### Option 1: Automated Startup (Windows)
```bash
start.bat
```

### Option 2: Manual Startup

**Step 1: Start Backend API**
```bash
pip install -r api_requirements.txt
python api.py
```

**Step 2: Start Frontend (new terminal)**
```bash
cd frontend
npm install
npm run dev
```

## Access Points

- **Frontend Application**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## Model Integration

The system now uses your new `stage1_general_screener.pkl` model for:

- **Real-time risk prediction** based on patient vitals
- **Intelligent recommendations** tailored to each patient
- **Clinical decision support** for frontline healthcare workers

## Key Features

### Frontend (Next.js + TypeScript)
- Modern, responsive triage dashboard
- Real-time form validation
- Loading states and error handling
- Multi-language support (English, Sinhala, Tamil)

### Backend (FastAPI + Python)
- RESTful API with automatic documentation
- Model serving with proper error handling
- Input validation and sanitization
- CORS support for frontend integration

### Model Features
- **Input Features**: Age, Systolic BP, Diastolic BP, BMI, Heart Rate, Temperature
- **Output**: Risk level (low/high), risk score, clinical recommendations
- **Smart Analysis**: BP status, observation status, personalized recommendations

## API Endpoints

### POST /predict-risk
Analyzes patient vitals and returns risk assessment.

**Request Body:**
```json
{
  "patient_name": "Patient Name",
  "age": 28,
  "systolic": 120,
  "diastolic": 80,
  "bmi": 24.5,
  "heart_rate": 78,
  "temperature": 36.8
}
```

**Response:**
```json
{
  "risk_level": "low",
  "risk_score": 0.12,
  "recommendations": [
    "Routine prenatal care recommended",
    "Continue regular monitoring"
  ],
  "bp_status": "Normal",
  "observation": "Stable"
}
```

## File Structure

```
frontend bloomcare/
├── api.py                 # FastAPI backend server
├── api_requirements.txt    # Python dependencies
├── start.bat             # Windows startup script
├── stage1_general_screener.pkl  # Your ML model
├── frontend/             # Next.js frontend
│   ├── components/
│   │   └── frontline-triage-dashboard.tsx
│   └── package.json
└── models/               # Additional model files
```

## Development Notes

1. **Model Placement**: Ensure `stage1_general_screener.pkl` is in the root directory
2. **Port Configuration**: Backend runs on 8000, frontend on 3000
3. **Error Handling**: Frontend displays connection errors if backend is unavailable
4. **Data Validation**: Both frontend and backend validate input data

## Troubleshooting

- **Backend not starting**: Check Python dependencies and model file location
- **Frontend errors**: Ensure backend is running on port 8000
- **Model loading issues**: Verify `stage1_general_screener.pkl` exists and is readable
- **CORS errors**: Backend is configured for localhost:3000, adjust if needed
