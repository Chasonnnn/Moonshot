from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings

ALLOWED_ROLES = {"org_admin", "reviewer", "candidate"}
bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class UserContext:
    role: str
    user_id: str
    tenant_id: str


@dataclass(frozen=True)
class IssuedToken:
    access_token: str
    token_type: str
    expires_at: datetime
    kid: str


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _extract_bearer_token(token: str | None) -> str:
    if token is None:
        raise _unauthorized("Missing bearer token")
    token = token.strip()
    if not token:
        raise _unauthorized("Invalid bearer token format")
    return token


def issue_access_token(
    *,
    role: str,
    user_id: str,
    tenant_id: str,
    expires_in_seconds: int | None = None,
    kid: str | None = None,
) -> IssuedToken:
    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown role")

    settings = get_settings()
    resolved_kid = kid or settings.jwt_active_kid
    signing_key = settings.jwt_signing_keys.get(resolved_kid)
    if signing_key is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Signing key not configured")

    now = datetime.now(timezone.utc)
    ttl_seconds = expires_in_seconds or settings.jwt_default_ttl_seconds
    expires_at = now + timedelta(seconds=ttl_seconds)

    payload = {
        "sub": user_id,
        "role": role,
        "tenant_id": tenant_id,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
    }
    token = jwt.encode(payload, signing_key, algorithm="HS256", headers={"kid": resolved_kid})
    return IssuedToken(access_token=token, token_type="bearer", expires_at=expires_at, kid=resolved_kid)


def get_user_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> UserContext:
    settings = get_settings()
    token = _extract_bearer_token(credentials.credentials if credentials is not None else None)

    try:
        headers = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError as exc:
        raise _unauthorized("Invalid bearer token") from exc

    kid = headers.get("kid")
    if not isinstance(kid, str) or not kid:
        raise _unauthorized("Missing token kid")

    signing_key = settings.jwt_signing_keys.get(kid)
    if signing_key is None:
        raise _unauthorized("Unknown token kid")

    try:
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["HS256"],
            issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
        )
    except jwt.ExpiredSignatureError as exc:
        raise _unauthorized("Token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise _unauthorized("Invalid bearer token") from exc

    role = claims.get("role")
    user_id = claims.get("sub")
    tenant_id = claims.get("tenant_id")

    if role not in ALLOWED_ROLES:
        raise _unauthorized("Unknown role")
    if not isinstance(user_id, str) or not user_id:
        raise _unauthorized("Invalid subject")
    if not isinstance(tenant_id, str) or not tenant_id:
        raise _unauthorized("Invalid tenant")

    return UserContext(role=role, user_id=user_id, tenant_id=tenant_id)
