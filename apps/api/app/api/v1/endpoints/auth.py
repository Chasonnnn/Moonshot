from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, status

from app.core.config import get_settings
from app.core.security import issue_access_token
from app.schemas import AuthTokenRequest, AuthTokenResponse

router = APIRouter(prefix="/v1/auth", tags=["auth"])


@router.post("/token", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
def issue_token(
    payload: AuthTokenRequest,
    x_bootstrap_token: str | None = Header(default=None, alias="X-Bootstrap-Token"),
) -> AuthTokenResponse:
    settings = get_settings()
    if x_bootstrap_token != settings.auth_bootstrap_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bootstrap token")

    issued = issue_access_token(
        role=payload.role,
        user_id=payload.user_id,
        tenant_id=payload.tenant_id,
        expires_in_seconds=payload.expires_in_seconds,
    )
    return AuthTokenResponse(
        access_token=issued.access_token,
        token_type=issued.token_type,
        expires_at=issued.expires_at,
        kid=issued.kid,
    )
