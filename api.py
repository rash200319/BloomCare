from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
import logging
from datetime import datetime
from io import BytesIO
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

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
    expose_headers=["Content-Disposition", "Content-Type"],
)

# Load the model
try:
    model_path = Path(__file__).parent / "stage1_general_risk_screener.pkl"
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
        probability = model.predict_proba(
            input_data)[0][1]  # Probability of high risk

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
            recommendations.append(
                "Blood pressure low - review for hypotension")
            bp_status = "Low"

        # Check BMI
        if vitals.bmi >= 30:
            recommendations.append("BMI elevated - discuss weight management")
        elif vitals.bmi < 18.5:
            recommendations.append(
                "BMI low - nutritional assessment recommended")

        # Check heart rate
        if vitals.heart_rate > 100:
            recommendations.append(
                "Heart rate elevated - further evaluation needed")
        elif vitals.heart_rate < 60:
            recommendations.append(
                "Heart rate low - cardiac assessment recommended")

        # Check temperature
        if vitals.temperature > 37.5:
            recommendations.append(
                "Temperature elevated - investigate infection")
        elif vitals.temperature < 36.0:
            recommendations.append("Temperature low - monitor for hypothermia")

        # Add risk-specific recommendations
        if risk_level == "high":
            recommendations.append(
                "High risk detected - immediate clinical review required")
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
        raise HTTPException(
            status_code=500, detail=f"Prediction failed: {str(e)}")


@app.get("/export/monthly-screening-trends")
async def export_monthly_screening_trends():
    """
    Export monthly screening trends as a PDF report for district managers.
    Returns a downloadable PDF file.
    """
    try:
        # Sample monthly screening data (in production, this would come from a database)
        monthly_data = [
            {"month": "January", "screenings": 1245,
                "escalations": 187, "low_risk": 1058},
            {"month": "February", "screenings": 1380,
                "escalations": 207, "low_risk": 1173},
            {"month": "March", "screenings": 1520,
                "escalations": 228, "low_risk": 1292},
            {"month": "April", "screenings": 1650,
                "escalations": 264, "low_risk": 1386},
            {"month": "May", "screenings": 1890,
                "escalations": 302, "low_risk": 1588},
            {"month": "June", "screenings": 2100,
                "escalations": 336, "low_risk": 1764},
        ]

        # Create PDF in memory
        pdf_buffer = BytesIO()
        doc = SimpleDocTemplate(pdf_buffer, pagesize=A4,
                                topMargin=0.5*inch, bottomMargin=0.5*inch)

        # Container for PDF elements
        elements = []

        # Define styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#FB7185'),
            spaceAfter=6,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        )

        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#1E293B'),
            spaceAfter=12,
            fontName='Helvetica-Bold'
        )

        subtitle_style = ParagraphStyle(
            'Subtitle',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#64748B'),
            spaceAfter=20,
            alignment=TA_CENTER,
            fontName='Helvetica'
        )

        # Add title
        elements.append(Paragraph("BloomCare", title_style))
        elements.append(
            Paragraph("Monthly Screening Trends Report", heading_style))
        elements.append(Spacer(1, 0.3*inch))

        # Add metadata
        report_date = datetime.now().strftime("%B %d, %Y")
        elements.append(
            Paragraph(f"Report Generated: {report_date}", subtitle_style))
        elements.append(Spacer(1, 0.3*inch))

        # Calculate summary statistics
        total_screenings = sum(d['screenings'] for d in monthly_data)
        total_escalations = sum(d['escalations'] for d in monthly_data)
        total_low_risk = sum(d['low_risk'] for d in monthly_data)
        avg_escalation_rate = (
            total_escalations / total_screenings * 100) if total_screenings > 0 else 0

        # Add summary statistics
        elements.append(Paragraph("Summary Statistics", heading_style))
        summary_data = [
            ['Metric', 'Value'],
            ['Total Screenings', str(total_screenings)],
            ['Total Escalations', str(total_escalations)],
            ['Total Low Risk Cases', str(total_low_risk)],
            ['Average Escalation Rate', f"{avg_escalation_rate:.1f}%"],
        ]

        summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#FB7185')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1),
             [colors.white, colors.HexColor('#F1F5F9')]),
        ]))

        elements.append(summary_table)
        elements.append(Spacer(1, 0.3*inch))

        # Add monthly breakdown table
        elements.append(PageBreak())
        elements.append(Paragraph("Monthly Breakdown", heading_style))
        elements.append(Spacer(1, 0.2*inch))

        table_data = [['Month', 'Total Screenings',
                       'Escalations', 'Low Risk', 'Escalation %']]

        for row in monthly_data:
            escalation_pct = (
                row['escalations'] / row['screenings'] * 100) if row['screenings'] > 0 else 0
            table_data.append([
                row['month'],
                str(row['screenings']),
                str(row['escalations']),
                str(row['low_risk']),
                f"{escalation_pct:.1f}%"
            ])

        monthly_table = Table(table_data, colWidths=[
                              1.5*inch, 1.5*inch, 1.2*inch, 1.2*inch, 1.2*inch])
        monthly_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#FB7185')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1),
             [colors.white, colors.HexColor('#F1F5F9')]),
        ]))

        elements.append(monthly_table)
        elements.append(Spacer(1, 0.3*inch))

        # Add insights
        elements.append(PageBreak())
        elements.append(Paragraph("Key Insights", heading_style))
        elements.append(Spacer(1, 0.2*inch))

        insights = [
            f"• Total screenings across all months: {total_screenings}",
            f"• Total escalations requiring clinical review: {total_escalations}",
            f"• Average escalation rate: {avg_escalation_rate:.1f}%",
            f"• Trend: Screenings show {('increasing' if monthly_data[-1]['screenings'] > monthly_data[0]['screenings'] else 'decreasing')} trend",
            f"• Latest month ({monthly_data[-1]['month']}): {monthly_data[-1]['screenings']} screenings with {monthly_data[-1]['escalations']} escalations",
        ]

        for insight in insights:
            elements.append(Paragraph(insight, styles['Normal']))
            elements.append(Spacer(1, 0.1*inch))

        # Build PDF
        doc.build(elements)

        # Prepare response
        pdf_buffer.seek(0)
        filename = f"BloomCare_Monthly_Screening_Report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

        return FileResponse(
            pdf_buffer,
            media_type='application/pdf',
            filename=filename,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        logger.error(f"PDF export error: {e}")
        raise HTTPException(
            status_code=500, detail=f"PDF generation failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
