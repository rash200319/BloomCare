"""
Appointment Management Service
Handles appointment booking, scheduling, queue management, and availability
"""
from datetime import datetime, timedelta, time
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, text
from fastapi import HTTPException, status

from backend.models.appointment import Appointment
from backend.models.user import User, UserRole
from backend.models.patient import Patient
from backend.schemas.appointment import (
    AppointmentResponse, SpecialistResponse, TimeSlot,
    AvailabilityResponse, AppointmentListResponse, SpecializationResponse
)


class AppointmentService:
    """Service for managing appointments"""
    
    # Working hours: 8 AM to 5 PM
    WORKING_START_HOUR = 8
    WORKING_END_HOUR = 17
    SLOT_DURATION_MINUTES = 30
    
    @staticmethod
    def get_specializations(db: Session) -> list[SpecializationResponse]:
        """Get list of all specializations with specialist count"""
        specialists = db.query(
            User.specialization,
            func.count(User.id).label('specialist_count')
        ).filter(
            and_(
                User.role == UserRole.CLINICAL_SPECIALIST,
                User.specialization.isnot(None),
                User.is_active == True
            )
        ).group_by(User.specialization).all()
        
        if not specialists:
            return []
        
        return [
            SpecializationResponse(
                specialization=spec.specialization,
                specialist_count=spec.specialist_count
            )
            for spec in specialists
        ]
    
    @staticmethod
    def get_specialists_by_specialization(
        db: Session, specialization: str
    ) -> list[SpecialistResponse]:
        """Get all active specialists for a given specialization"""
        specialists = db.query(User).filter(
            and_(
                User.role == UserRole.CLINICAL_SPECIALIST,
                User.specialization.ilike(f"%{specialization}%"),
                User.is_active == True
            )
        ).all()
        
        if not specialists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No specialists found for specialization '{specialization}'"
            )
        
        return [
            SpecialistResponse(
                id=str(spec.id),
                user_id=spec.user_id,
                full_name=spec.full_name,
                specialization=spec.specialization,
                telephone=spec.telephone,
                email=spec.email
            )
            for spec in specialists
        ]
    
    @staticmethod
    def book_appointment(
        db: Session,
        patient_id: str,
        specialist_name: str,
        appointment_date: datetime,
        duration_minutes: int = 30,
        notes: str = None
    ) -> AppointmentResponse:
        """
        Book an appointment for a patient with a specialist.
        
        Validates:
        - Patient exists
        - Specialist exists and is active
        - No double booking
        - Appointment date is in the future
        
        Returns: Appointment with assigned queue number
        """
        # Verify patient exists
        patient = db.query(Patient).filter(Patient.user_id == patient_id).first()
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Patient with ID '{patient_id}' not found"
            )
        
        # Look up specialist by name
        specialist = db.query(User).filter(
            and_(
                User.full_name.ilike(f"%{specialist_name}%"),
                User.role == UserRole.CLINICAL_SPECIALIST,
                User.is_active == True
            )
        ).first()
        
        if not specialist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Specialist '{specialist_name}' not found"
            )
        
        # Validate appointment date is in future
        now = datetime.utcnow().replace(tzinfo=appointment_date.tzinfo)
        if appointment_date < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Appointment date must be in the future"
            )
        
        # Check for double booking using database function
        double_booking_check = db.execute(
            text("""
                SELECT check_double_booking(:specialist_id, :appointment_date, :duration) AS is_booked
            """),
            {
                "specialist_id": str(specialist.id),
                "appointment_date": appointment_date,
                "duration": duration_minutes
            }
        ).scalar()
        
        if double_booking_check:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This time slot is already booked for the specialist"
            )
        
        # Get next queue number for this specialist on this date
        queue_number = db.execute(
            text("""
                SELECT get_next_queue_number(:specialist_id, :appointment_date) AS next_queue
            """),
            {
                "specialist_id": str(specialist.id),
                "appointment_date": appointment_date
            }
        ).scalar()
        
        # Create appointment
        appointment = Appointment(
            id=str(__import__('uuid').uuid4()),
            patient_id=patient.id,
            specialist_id=specialist.id,
            appointment_date=appointment_date,
            duration_minutes=duration_minutes,
            queue_number=queue_number,
            status="SCHEDULED",
            notes=notes
        )
        
        db.add(appointment)
        db.commit()
        db.refresh(appointment)
        
        # Return response with patient and specialist names
        return AppointmentResponse(
            id=appointment.id,
            patient_id=appointment.patient_id,
            patient_name=patient.full_name,
            specialist_id=str(appointment.specialist_id),
            specialist_name=specialist.full_name,
            appointment_date=appointment.appointment_date,
            duration_minutes=appointment.duration_minutes,
            queue_number=appointment.queue_number,
            status=appointment.status,
            notes=appointment.notes,
            created_at=appointment.created_at,
            updated_at=appointment.updated_at
        )
    
    @staticmethod
    def get_appointments_by_specialist(
        db: Session,
        specialist_name: str,
        date: str = None  # YYYY-MM-DD format
    ) -> AppointmentListResponse:
        """
        Get appointments for a specialist, optionally filtered by date.
        Ordered by queue number.
        """
        # Look up specialist
        specialist = db.query(User).filter(
            and_(
                User.full_name.ilike(f"%{specialist_name}%"),
                User.role == UserRole.CLINICAL_SPECIALIST
            )
        ).first()
        
        if not specialist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Specialist '{specialist_name}' not found"
            )
        
        # Build query
        query = db.query(Appointment).filter(
            and_(
                Appointment.specialist_id == specialist.id,
                Appointment.status != "CANCELLED"
            )
        )
        
        # Filter by date if provided
        if date:
            try:
                filter_date = datetime.strptime(date, "%Y-%m-%d").date()
                query = query.filter(
                    func.date(Appointment.appointment_date) == filter_date
                )
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date format. Use YYYY-MM-DD"
                )
        
        appointments = query.order_by(
            func.date(Appointment.appointment_date),
            Appointment.queue_number
        ).all()
        
        if not appointments:
            return AppointmentListResponse(
                specialist_name=specialist.full_name,
                specialization=specialist.specialization or "General",
                date=date or "All dates",
                appointments=[],
                total_appointments=0
            )
        
        # Build response
        appointment_responses = []
        for apt in appointments:
            patient = db.query(Patient).filter(Patient.id == apt.patient_id).first()
            appointment_responses.append(
                AppointmentResponse(
                    id=apt.id,
                    patient_id=apt.patient_id,
                    patient_name=patient.full_name if patient else "Unknown",
                    specialist_id=str(apt.specialist_id),
                    specialist_name=specialist.full_name,
                    appointment_date=apt.appointment_date,
                    duration_minutes=apt.duration_minutes,
                    queue_number=apt.queue_number,
                    status=apt.status,
                    notes=apt.notes,
                    created_at=apt.created_at,
                    updated_at=apt.updated_at
                )
            )
        
        return AppointmentListResponse(
            specialist_name=specialist.full_name,
            specialization=specialist.specialization or "General",
            date=date or "All dates",
            appointments=appointment_responses,
            total_appointments=len(appointment_responses)
        )
    
    @staticmethod
    def get_specialist_availability(
        db: Session,
        specialist_name: str,
        days_ahead: int = 14
    ) -> list[AvailabilityResponse]:
        """
        Get available time slots for a specialist for the next N days.
        Time slots: 8 AM to 5 PM, 30-minute intervals
        Excludes weekends (optional) and already booked slots
        """
        # Look up specialist
        specialist = db.query(User).filter(
            and_(
                User.full_name.ilike(f"%{specialist_name}%"),
                User.role == UserRole.CLINICAL_SPECIALIST,
                User.is_active == True
            )
        ).first()
        
        if not specialist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Specialist '{specialist_name}' not found"
            )
        
        availability_list = []
        now = datetime.utcnow()
        
        for day_offset in range(days_ahead):
            current_date = now.date() + timedelta(days=day_offset)
            
            # Skip weekends (optional: remove this to include weekends)
            if current_date.weekday() >= 5:  # 5 = Saturday, 6 = Sunday
                continue
            
            slots = []
            current_time = current_date.replace(
                hour=AppointmentService.WORKING_START_HOUR,
                minute=0,
                second=0
            )
            end_time = current_date.replace(
                hour=AppointmentService.WORKING_END_HOUR,
                minute=0,
                second=0
            )
            
            # Generate time slots
            while current_time < end_time:
                slot_end = current_time + timedelta(
                    minutes=AppointmentService.SLOT_DURATION_MINUTES
                )
                
                # Check if slot is booked
                booked = db.query(Appointment).filter(
                    and_(
                        Appointment.specialist_id == specialist.id,
                        Appointment.appointment_date <= current_time,
                        Appointment.appointment_date + timedelta(
                            minutes=Appointment.duration_minutes
                        ) > current_time,
                        Appointment.status != "CANCELLED"
                    )
                ).first()
                
                # Get patient name if booked
                patient_name = None
                if booked:
                    patient = db.query(Patient).filter(
                        Patient.id == booked.patient_id
                    ).first()
                    patient_name = patient.full_name if patient else "Unknown"
                
                slots.append(
                    TimeSlot(
                        start_time=current_time,
                        end_time=slot_end,
                        is_available=booked is None,
                        booked_by=patient_name
                    )
                )
                
                current_time = slot_end
            
            # Count available slots
            available_count = sum(1 for slot in slots if slot.is_available)
            
            availability_list.append(
                AvailabilityResponse(
                    specialist_id=str(specialist.id),
                    specialist_name=specialist.full_name,
                    specialization=specialist.specialization or "General",
                    date=current_date.strftime("%Y-%m-%d"),
                    available_slots=slots,
                    total_available=available_count
                )
            )
        
        return availability_list
