import uuid
from typing import Annotated
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User, RoleEnum
from app.utils.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_current_user(
    token: Annotated[str | None, Depends(oauth2_scheme)] = None,
    db: AsyncSession = Depends(get_db)
) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Необходима авторизация",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный или истекший токен",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        user_id = uuid.UUID(payload["sub"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Некорректный идентификатор пользователя в токене",
        )
    
    query = (
        select(User)
        .options(selectinload(User.roles), selectinload(User.organization))
        .where(User.id == user_id)
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден",
        )
    
    return user


async def get_current_user_optional(
    token: Annotated[str | None, Depends(oauth2_scheme)] = None,
    db: AsyncSession = Depends(get_db)
) -> User | None:
    if not token:
        return None
    try:
        return await get_current_user(token=token, db=db)
    except HTTPException:
        return None


async def get_active_role(
    current_user: Annotated[User, Depends(get_current_user)],
    x_active_role: Annotated[str | None, Header(alias="X-Active-Role")] = None,
) -> str:
    approved_roles = current_user.available_roles
    if not approved_roles:
        return current_user.active_role or "pending"
    
    if x_active_role:
        clean_role = x_active_role.lower().strip()
        if clean_role in approved_roles:
            return clean_role
        if RoleEnum.FEDERATION.value in approved_roles:
            return clean_role
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Роль '{clean_role}' недоступна для текущего пользователя. Доступные утвержденные роли: {approved_roles}",
        )
    
    # Default to federation if present, otherwise first role
    if RoleEnum.FEDERATION.value in approved_roles:
        return RoleEnum.FEDERATION.value
    return approved_roles[0]


def require_role(allowed_roles: list[RoleEnum | str]):
    allowed = [r.value if hasattr(r, "value") else str(r) for r in allowed_roles]

    async def role_checker(
        current_user: Annotated[User, Depends(get_current_user)],
        active_role: Annotated[str, Depends(get_active_role)]
    ) -> User:
        approved_roles = current_user.available_roles
        
        # If active role is in allowed roles and is approved, proceed
        if active_role in allowed and active_role in approved_roles:
            return current_user
        
        # If user has federation role, allow access as administrator
        if RoleEnum.FEDERATION.value in approved_roles:
            return current_user
            
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Действие требует одну из утвержденных ролей: {allowed}. Ваша активная роль: '{active_role}'",
        )

    return role_checker


require_roles = require_role
require_federation = require_role([RoleEnum.FEDERATION])
require_coach = require_role([RoleEnum.COACH, RoleEnum.FEDERATION])
require_athlete = require_role([RoleEnum.ATHLETE, RoleEnum.FEDERATION])
require_judge = require_role([RoleEnum.JUDGE, RoleEnum.FEDERATION])
require_coach_or_athlete = require_role([RoleEnum.ATHLETE, RoleEnum.COACH, RoleEnum.FEDERATION])

