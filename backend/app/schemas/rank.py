import uuid
from datetime import date, datetime
from pydantic import BaseModel
from app.models.rank import RankType, RankApplicationStatus


class RankRecordCreate(BaseModel):
    athlete_id: uuid.UUID
    rank: RankType
    assigned_date: date
    order_number: str | None = None
    valid_until: date | None = None  # None for MS / MSIC


class RankRecordResponse(BaseModel):
    id: uuid.UUID
    athlete_id: uuid.UUID
    athlete_name: str | None = None
    rank: RankType
    assigned_date: date
    order_number: str | None = None
    valid_until: date | None = None
    status: str
    days_left: int | None = None
    is_expiring_soon: bool = False

    model_config = {"from_attributes": True}


class RankApplicationCreate(BaseModel):
    athlete_id: uuid.UUID | None = None  # None if applying for self
    requested_rank: RankType
    competition_id: uuid.UUID
    result_id: uuid.UUID


class RankApplicationUpdate(BaseModel):
    status: RankApplicationStatus
    rejection_reason: str | None = None
    order_number: str | None = None
    assigned_date: date | None = None


class RankApplicationResponse(BaseModel):
    id: uuid.UUID
    athlete_id: uuid.UUID
    athlete_name: str | None = None
    submitted_by: uuid.UUID
    submitted_by_name: str | None = None
    requested_rank: RankType
    competition_id: uuid.UUID
    competition_title: str | None = None
    result_id: uuid.UUID
    result_place: int | None = None
    status: RankApplicationStatus
    rejection_reason: str | None = None
    submitted_at: datetime
    reviewed_at: datetime | None = None

    model_config = {"from_attributes": True}


class EvskCheckResponse(BaseModel):
    eligible: bool
    recommended_rank: str | None = None
    reason: str


RankRecordRead = RankRecordResponse
RankApplicationRead = RankApplicationResponse
RankApplicationReview = RankApplicationUpdate

from app.schemas.judge import (
    JudgeCategoryRecordRead, JudgeCategoryApplicationCreate,
    JudgeCategoryApplicationReview, JudgeCategoryApplicationRead,
    JudgeAssignmentCreate, JudgeAssignmentRead
)


# Compatibility aliases
RankRecordRead = RankRecordResponse
RankApplicationReview = RankApplicationUpdate
RankApplicationRead = RankApplicationResponse

