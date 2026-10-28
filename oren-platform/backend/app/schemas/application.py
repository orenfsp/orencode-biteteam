import uuid
from datetime import datetime, date
from pydantic import BaseModel
from app.models.application import ApplicationStatus


class ApplicationCreate(BaseModel):
    competition_id: uuid.UUID
    athlete_id: uuid.UUID | None = None  # None if applying for self


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus
    rejection_reason: str | None = None


class ApplicationResponse(BaseModel):
    id: uuid.UUID
    athlete_id: uuid.UUID
    athlete_name: str | None = None
    athlete_birth_date: date | None = None
    athlete_organization: str | None = None
    athlete_municipality: str | None = None
    competition_id: uuid.UUID
    competition_title: str | None = None
    submitted_by: uuid.UUID
    submitted_by_name: str | None = None
    status: ApplicationStatus
    rejection_reason: str | None = None
    submitted_at: datetime
    reviewed_at: datetime | None = None
    reviewed_by: uuid.UUID | None = None

    model_config = {"from_attributes": True}


# Compatibility aliases
ApplicationReview = ApplicationStatusUpdate
ApplicationRead = ApplicationResponse

