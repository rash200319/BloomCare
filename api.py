from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="BloomCare ML API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the model
try:
    model_path = Path(__file__).parent / "stage1_general_screener.pkl"
    model = joblib.load(model_path)
    logger.info(f"Model loaded successfully from {model_path}")
except Exception as e:
    logger.error(f"Error loading model: {e}")
    model = None

class VitalsInput(BaseModel):
    patient_name: str
    age: int
    systolic: int
    diastolic: int
    bmi: float
    heart_rate: int
    temperature: float

class RiskResponse(BaseModel):
    risk_level: str  # "low" or "high"
    risk_score: float
    recommendations: list[str]
    bp_status: str
    observation: str

@app.get("/")
async def root():
    return {"message": "BloomCare ML API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "model_loaded": model is not None}

@app.post("/predict-risk", response_model=RiskResponse)
async def predict_risk(vitals: VitalsInput):
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")
    
    try:
        # Prepare input data in the format expected by the model
        # The model was trained with these features: Age, Systolic, Diastolic, BMI, HeartRate, Temperature
        input_data = pd.DataFrame([{
            'Age': vitals.age,
            'Systolic': vitals.systolic, 
            'Diastolic': vitals.diastolic,
            'BMI': vitals.bmi,
            'HeartRate': vitals.heart_rate,
            'Temperature': vitals.temperature
        }])
        
        # Make prediction
        prediction = model.predict(input_data)[0]
        probability = model.predict_proba(input_data)[0][1]  # Probability of high risk
        
        # Determine risk level
        risk_level = "high" if prediction == 1 else "low"
        risk_score = float(probability)
        
        # Generate recommendations based on vitals and risk
        recommendations = []
        bp_status = "Normal"
        observation = "Stable"
        
        # Check BP
        if vitals.systolic >= 140 or vitals.diastolic >= 90:
            recommendations.append("Blood pressure elevated - monitor closely")
            bp_status = "High"
        elif vitals.systolic < 90 or vitals.diastolic < 60:
            recommendations.append("Blood pressure low - review for hypotension")
            bp_status = "Low"
        
        # Check BMI
        if vitals.bmi >= 30:
            recommendations.append("BMI elevated - discuss weight management")
        elif vitals.bmi < 18.5:
            recommendations.append("BMI low - nutritional assessment recommended")
        
        # Check heart rate
        if vitals.heart_rate > 100:
            recommendations.append("Heart rate elevated - further evaluation needed")
        elif vitals.heart_rate < 60:
            recommendations.append("Heart rate low - cardiac assessment recommended")
        
        # Check temperature
        if vitals.temperature > 37.5:
            recommendations.append("Temperature elevated - investigate infection")
        elif vitals.temperature < 36.0:
            recommendations.append("Temperature low - monitor for hypothermia")
        
        # Add risk-specific recommendations
        if risk_level == "high":
            recommendations.append("High risk detected - immediate clinical review required")
            recommendations.append("Consider referral to specialist")
            observation = "Requires Attention"
        else:
            recommendations.append("Routine prenatal care recommended")
            recommendations.append("Continue regular monitoring")
        
        return RiskResponse(
            risk_level=risk_level,
            risk_score=risk_score,
            recommendations=recommendations,
            bp_status=bp_status,
            observation=observation
        )
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
