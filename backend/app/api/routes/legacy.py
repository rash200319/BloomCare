"""
Legacy compatibility endpoint
The original frontend calls POST /predict-risk (from api.py).
This shim maps it to the new Stage 1 service so the frontend
works without any changes to the existing code.
"""

from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.models import User
from app.schemas.schemas import Stage1Input, Stage1Response
from app.services.predict_stage1 import predict_stage1_risk

router = APIRouter(tags=["Legacy Compat"])


@router.post(
    "/predict-risk",
    response_model=Stage1Response,
    include_in_schema=False,   # hide from docs; use /stage1/predict instead
)
def legacy_predict_risk(body: Stage1Input, db: Annotated[Session, Depends(get_db)]):
    """Backward-compatible alias for POST /api/v1/stage1/predict (no auth required for legacy)."""
    return predict_stage1_risk(body)
