from fastapi import APIRouter, Depends, HTTPException, status
from typing import Any
import logging

from ...core.deps import get_optional_current_active_user
from ...core.config import settings
from ...schemas.screening import AssistantRequest, AssistantResponse
from ...models.user import User

try:
    from ...llm_service import generate_mock_explanation, generate_multilingual_explanation
except ImportError:
    pass

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/explain", response_model=AssistantResponse)
async def assistant_explain(
    request: AssistantRequest,
    current_user: User | None = Depends(get_optional_current_active_user),
) -> Any:
    # Role RBAC inside the function
    try:
        if settings.BLOOMCARE_MOCK_LLM or not settings.OPENAI_API_KEY:
            result = await generate_mock_explanation(
                ml_output=request.ml_output,
                requester_role=request.requester_role,
            )
        else:
            result = await generate_multilingual_explanation(
                ml_output=request.ml_output,
                openai_api_key=settings.OPENAI_API_KEY,
                requester_role=request.requester_role,
                model=settings.BLOOMCARE_OPENAI_MODEL,
            )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return result
