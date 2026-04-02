"""
Dashboard Endpoints - Role-based Access Control
Each dashboard is restricted to specific user roles
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.core.deps import get_db, get_current_user
from backend.models.user import User, UserRole

router = APIRouter()


@router.get(
    "/admin/dashboard",
    summary="Admin Dashboard",
    description="Admin-only access to admin dashboard"
)
def get_admin_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get admin dashboard data.
    
    **Access:** ADMIN role only
    
    Returns:
    - Admin dashboard information and statistics
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can access the admin dashboard"
        )
    
    return {
        "message": "Welcome to Admin Dashboard",
        "user_id": current_user.user_id,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
        "dashboard": {
            "title": "Admin Dashboard",
            "description": "Manage staff, patients, and system settings",
            "features": [
                "Staff Management",
                "Patient Management",
                "System Monitoring",
                "Appointment Management",
                "Reports & Analytics"
            ]
        }
    }


@router.get(
    "/doctor/dashboard",
    summary="Doctor/Clinical Dashboard",
    description="Doctor-only access to clinical dashboard"
)
def get_doctor_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get doctor/clinical dashboard data.
    
    **Access:** CLINICAL_SPECIALIST role only
    
    Returns:
    - Doctor dashboard information and patient appointments
    """
    if current_user.role != UserRole.CLINICAL_SPECIALIST:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only clinical specialists can access the doctor dashboard"
        )
    
    return {
        "message": "Welcome to Doctor Dashboard",
        "user_id": current_user.user_id,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
        "specialization": current_user.specialization,
        "dashboard": {
            "title": "Clinical Dashboard",
            "description": "View and manage patient appointments",
            "features": [
                "Today's Appointments",
                "Patient Queue",
                "Patient History",
                "Clinical Notes",
                "Appointment Scheduling"
            ]
        }
    }


@router.get(
    "/patient/dashboard",
    summary="Patient Portal",
    description="Patient-only access to patient portal"
)
def get_patient_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get patient portal data.
    
    **Access:** PATIENT role only
    
    Returns:
    - Patient dashboard information and appointment details
    """
    if current_user.role != UserRole.PATIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can access the patient portal"
        )
    
    return {
        "message": "Welcome to Your Health Portal",
        "user_id": current_user.user_id,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
        "dashboard": {
            "title": "Patient Portal",
            "description": "View your appointments and health records",
            "features": [
                "My Appointments",
                "Appointment Booking",
                "Medical History",
                "Test Results",
                "Recommendations"
            ]
        }
    }


@router.get(
    "/frontline/dashboard",
    summary="Frontline Staff Dashboard",
    description="Frontline staff-only access to triage dashboard"
)
def get_frontline_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get frontline staff (triage) dashboard data.
    
    **Access:** FRONTLINE_STAFF role only
    
    Returns:
    - Frontline dashboard information and patient triage features
    """
    if current_user.role != UserRole.FRONTLINE_STAFF:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only frontline staff can access the triage dashboard"
        )
    
    return {
        "message": "Welcome to Triage Dashboard",
        "user_id": current_user.user_id,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
        "dashboard": {
            "title": "Frontline Triage Dashboard",
            "description": "Screen patients and manage initial intake",
            "features": [
                "Patient Screening",
                "Vital Signs Entry",
                "Risk Assessment",
                "Patient Queue Management",
                "Referral to Specialists"
            ]
        }
    }
