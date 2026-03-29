"""
Admin Routes
GET  /api/v1/admin/users           → List all users
PUT  /api/v1/admin/users/{id}/role → Change a user's role
GET  /api/v1/admin/users/{id}      → Get user details
PUT  /api/v1/admin/users/{id}/deactivate → Deactivate user
GET  /api/v1/admin/activity        → Live system activity feed
GET  /api/v1/admin/stats           → System-wide KPI stats
"""

from typing import Annotated, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import generate_user_id
from app.dependencies.auth import require_admin
from app.models.models import User, UserRole, Patient, RiskRecord, RiskLevel
from app.schemas.schemas import UserPublic, UserRoleUpdate, MessageResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── List all users ─────────────────────────────────────────────────────────────
@router.get("/users", response_model=List[UserPublic])
def list_users(
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    role: str | None = Query(None, description="Filter by role"),
    is_active: bool | None = Query(None),
    skip: int = 0,
    limit: int = 100,
):
    query = db.query(User)
    if role:
        try:
            query = query.filter(User.role == UserRole(role.lower()))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid role.")
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    return query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()


# ── Get single user ────────────────────────────────────────────────────────────
@router.get("/users/{user_db_id}", response_model=UserPublic)
def get_user(
    user_db_id: int,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    user = db.query(User).filter(User.id == user_db_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


# ── Update user role ───────────────────────────────────────────────────────────
@router.put("/users/{user_db_id}/role", response_model=UserPublic)
def update_user_role(
    user_db_id: int,
    body: UserRoleUpdate,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    user = db.query(User).filter(User.id == user_db_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    new_role = UserRole(body.role)
    old_role = user.role

    if new_role != old_role:
        # Re-generate user_id under the new role
        role_count = db.query(User).filter(User.role == new_role).count()
        new_user_id = generate_user_id(body.role, role_count + 1)
        while db.query(User).filter(User.user_id == new_user_id).first():
            role_count += 1
            new_user_id = generate_user_id(body.role, role_count + 1)
        user.user_id = new_user_id
        user.role = new_role

    db.commit()
    db.refresh(user)
    return user


# ── Deactivate / Reactivate user ───────────────────────────────────────────────
@router.put("/users/{user_db_id}/deactivate", response_model=MessageResponse)
def toggle_user_active(
    user_db_id: int,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    activate: bool = Query(False, description="Set to true to re-activate"),
):
    if user_db_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account.")

    user = db.query(User).filter(User.id == user_db_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.is_active = activate
    db.commit()
    action = "activated" if activate else "deactivated"
    return MessageResponse(message=f"User {user.user_id} has been {action}.")


# ── Live activity feed ─────────────────────────────────────────────────────────
@router.get(
    "/activity",
    summary="Real-time system activity feed",
    description="Returns the latest risk records across all patients for the admin live feed.",
)
def activity_feed(
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(20, ge=1, le=100),
):
    records = (
        db.query(RiskRecord)
        .order_by(RiskRecord.created_at.desc())
        .limit(limit)
        .all()
    )

    feed = []
    for r in records:
        event_type = (
            "escalation" if r.risk_level == RiskLevel.high
            else "screening" if r.stage == "stage1"
            else "resolved"
        )
        patient_name = None
        try:
            patient_name = r.patient.user.full_name
        except Exception:
            pass

        feed.append({
            "id":         r.id,
            "event_type": event_type,
            "stage":      r.stage,
            "condition":  r.condition,
            "patient":    patient_name,
            "risk_level": r.risk_level.value,
            "probability": r.probability,
            "is_mock":    r.is_mock,
            "timestamp":  r.created_at.isoformat(),
        })

    return {"activity": feed, "total": len(feed)}


# ── System-wide KPI stats ──────────────────────────────────────────────────────
@router.get(
    "/stats",
    summary="System KPI statistics for Admin Dashboard",
)
def system_stats(
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    total_users      = db.query(User).count()
    total_patients   = db.query(Patient).count()
    total_screenings = db.query(RiskRecord).filter(RiskRecord.stage == "stage1").count()
    high_risk        = db.query(Patient).filter(Patient.current_risk_level == RiskLevel.high).count()

    # Users by role
    role_counts = {
        row.role.value: row.count
        for row in db.query(User.role, func.count(User.id).label("count")).group_by(User.role).all()
    }

    return {
        "total_users":        total_users,
        "total_patients":     total_patients,
        "total_screenings":   total_screenings,
        "high_risk_patients": high_risk,
        "users_by_role":      role_counts,
    }
