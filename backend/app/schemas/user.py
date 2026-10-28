import uuid
from datetime import date, datetime
from pydantic import BaseModel
from app.schemas.auth import UserResponse, UserUpdateRequest


class UserRead(UserResponse):
    pass


class UserUpdate(UserUpdateRequest):
    pass


class DisqualificationUpdate(BaseModel):
    is_disqualified: bool
    disqualification_reason: str | None = None
    disqualification_until: date | None = None


class CoachAthleteCreate(BaseModel):
    athlete_id: uuid.UUID
    discipline_id: int


class CoachAthleteRead(BaseModel):
    id: uuid.UUID
    coach_id: uuid.UUID
    coach_name: str | None = None
    athlete_id: uuid.UUID
    athlete_name: str | None = None
    discipline_id: int
    discipline_name: str | None = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RoleRequestRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str
    user_email: str
    role: str
    status: str
    requested_at: datetime
    reviewed_at: datetime | None = None
    rejection_reason: str | None = None
    organization_name: str | None = None
    municipality: str | None = None
    phone: str | None = None


class RoleRejectRequest(BaseModel):
    reason: str
