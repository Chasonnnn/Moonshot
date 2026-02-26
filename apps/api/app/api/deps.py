from fastapi import Depends, HTTPException, status

from app.core.security import UserContext, get_user_context


def require_roles(*allowed_roles: str):
    allowed_set = set(allowed_roles)

    def checker(user: UserContext = Depends(get_user_context)) -> UserContext:
        if user.role not in allowed_set:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user

    return checker
