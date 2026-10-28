import uuid
from datetime import date, datetime
from pydantic import BaseModel
from app.models.judge import JudgeCategoryType, JudgeCategoryAppStatus


class JudgeAssignmentCreate(BaseModel):
    judge_id: uuid.UUID
    competition_id: uuid.UUID
    position: str


class JudgeAssignmentResponse(BaseModel):
    id: uuid.UUID
    judge_id: uuid.UUID
    judge_name: str | None = None
    competition_id: uuid.UUID
    competition_title: str | None = None
    position: str
    created_at: datetime

    model_config = {"from_attributes": True}


class JudgeCategoryRecordCreate(BaseModel):
    judge_id: uuid.UUID
    category: JudgeCategoryType
    assigned_date: date
    valid_until: date
    order_number: str | None = None


class JudgeCategoryRecordResponse(BaseModel):
    id: uuid.UUID
    judge_id: uuid.UUID
    judge_name: str | None = None
    category: JudgeCategoryType
    assigned_date: date
    valid_until: date
    order_number: str | None = None
    status: str
    days_left: int | None = None
    is_expiring_soon: bool = False

    model_config = {"from_attributes": True}


class JudgeCategoryAppCreate(BaseModel):
    requested_category: JudgeCategoryType
    application_type: str = "assignment"  # assignment, confirmation


class JudgeCategoryAppUpdate(BaseModel):
    status: JudgeCategoryAppStatus
    rejection_reason: str | None = None
    order_number: str | None = None
    assigned_date: date | None = None
    valid_until: date | None = None


class JudgeCategoryAppResponse(BaseModel):
    id: uuid.UUID
    judge_id: uuid.UUID
    judge_name: str | None = None
    requested_category: JudgeCategoryType
    application_type: str
    status: JudgeCategoryAppStatus
    rejection_reason: str | None = None
    submitted_at: datetime
    reviewed_at: datetime | None = None

    model_config = {"from_attributes": True}


# Compatibility aliases
JudgeCategoryRecordRead = JudgeCategoryRecordResponse
JudgeCategoryApplicationCreate = JudgeCategoryAppCreate
JudgeCategoryApplicationReview = JudgeCategoryAppUpdate
JudgeCategoryApplicationRead = JudgeCategoryAppResponse
JudgeAssignmentRead = JudgeAssignmentResponse



JudgeCategoryRecordRead = JudgeCategoryRecordResponse
JudgeCategoryApplicationCreate = JudgeCategoryAppCreate
JudgeCategoryApplicationReview = JudgeCategoryAppUpdate
JudgeCategoryApplicationRead = JudgeCategoryAppResponse
JudgeAssignmentRead = JudgeAssignmentResponse
