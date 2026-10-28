import uuid
from datetime import date, datetime
from pydantic import BaseModel, EmailStr, Field
from app.models.user import RoleEnum


class UserRoleSchema(BaseModel):
    role: RoleEnum

    model_config = {"from_attributes": True}


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: uuid.UUID
    email: str
    full_name: str
    roles: list[str]
    active_role: str


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    roles: list[RoleEnum] = [RoleEnum.ATHLETE]
    birth_date: date | None = None
    municipality: str | None = None
    phone: str | None = None
    organization_id: uuid.UUID | None = None
    year_started: int | None = None
    sport_preparation_stage: str | None = None
    anti_doping_completed: bool = False
    anti_doping_date: date | None = None
    pd_consent: bool = True
    legal_rep_name: str | None = None
    legal_rep_phone: str | None = None
    legal_rep_email: str | None = None


class UserUpdateRequest(BaseModel):
    full_name: str | None = None
    birth_date: date | None = None
    municipality: str | None = None
    phone: str | None = None
    organization_id: uuid.UUID | None = None
    year_started: int | None = None
    sport_preparation_stage: str | None = None
    anti_doping_completed: bool | None = None
    anti_doping_date: date | None = None
    pd_consent: bool | None = None
    legal_rep_name: str | None = None
    legal_rep_phone: str | None = None
    legal_rep_email: str | None = None
    is_disqualified: bool | None = None
    disqualification_reason: str | None = None
    disqualification_until: date | None = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    roles: list[str]
    active_role: str | None = None
    birth_date: date | None = None
    municipality: str | None = None
    phone: str | None = None
    organization_id: uuid.UUID | None = None
    organization_name: str | None = None
    year_started: int | None = None
    sport_preparation_stage: str | None = None
    anti_doping_completed: bool = False
    anti_doping_date: date | None = None
    pd_consent: bool = False
    legal_rep_name: str | None = None
    legal_rep_phone: str | None = None
    legal_rep_email: str | None = None
    is_disqualified: bool = False
    disqualification_reason: str | None = None
    disqualification_until: date | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RoleSwitchRequest(BaseModel):
    role: RoleEnum


# Aliases for compatibility
Token = TokenResponse
LoginRequest = UserLoginRequest
RegisterRequest = UserRegisterRequest
SwitchRoleRequest = RoleSwitchRequest
TokenPayload = dict


# Compatibility aliases
Token = TokenResponse
LoginRequest = UserLoginRequest
RegisterRequest = UserRegisterRequest
SwitchRoleRequest = RoleSwitchRequest


class TokenPayload(BaseModel):
    sub: str
    active_role: str | None = None
    roles: list[str] = []

