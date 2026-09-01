"""Persist specialist review on Stage 1 screenings."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import String, cast, text
from sqlalchemy.orm import Session

from backend.models.screening import Stage1Screening


def _ensure_reviewed_at_column(db: Session) -> None:
    bind = db.get_bind()
    dialect = bind.dialect.name
    statements: list[str] = []
    if dialect == "postgresql":
        statements = [
            'ALTER TABLE IF EXISTS "BloomCare".stage1_screenings ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ',
            "ALTER TABLE IF EXISTS stage1_screenings ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ",
        ]
    elif dialect == "sqlite":
        statements = ["ALTER TABLE stage1_screenings ADD COLUMN reviewed_at DATETIME"]

    for statement in statements:
        try:
            db.execute(text(statement))
            db.commit()
        except Exception:
            db.rollback()


def mark_screening_reviewed(db: Session, screening: Stage1Screening) -> str:
    now = datetime.now(timezone.utc)
    screening_id = str(screening.id)
    try:
        updated = (
            db.query(Stage1Screening)
            .filter(cast(Stage1Screening.id, String) == screening_id)
            .update({"reviewed_at": now}, synchronize_session="fetch")
        )
        if updated != 1:
            raise HTTPException(status_code=404, detail="Screening not found")
        db.commit()
    except HTTPException:
        raise
    except Exception as first_exc:
        db.rollback()
        _ensure_reviewed_at_column(db)
        try:
            updated = (
                db.query(Stage1Screening)
                .filter(cast(Stage1Screening.id, String) == screening_id)
                .update({"reviewed_at": now}, synchronize_session="fetch")
            )
            if updated != 1:
                raise HTTPException(status_code=404, detail="Screening not found")
            db.commit()
        except HTTPException:
            raise
        except Exception as retry_exc:
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail=f"Unable to save review status: {retry_exc}",
            ) from first_exc
    return now.isoformat()


def find_screening_for_review(
    db: Session,
    *,
    patient_id: str | None = None,
    screening_id: str | None = None,
) -> Stage1Screening:
    screening = None
    if screening_id:
        screening = (
            db.query(Stage1Screening)
            .filter(cast(Stage1Screening.id, String) == str(screening_id))
            .first()
        )
    if screening is None and patient_id:
        screening = (
            db.query(Stage1Screening)
            .filter(cast(Stage1Screening.patient_id, String) == str(patient_id))
            .order_by(Stage1Screening.collected_at.desc(), Stage1Screening.synced_at.desc())
            .first()
        )
    if screening is None:
        raise HTTPException(status_code=404, detail="No screening found for this patient")
    return screening
