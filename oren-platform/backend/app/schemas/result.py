import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.result import ResultStatus


class ResultItemCreate(BaseModel):
    athlete_id: uuid.UUID
    place: int | None = None
    score: float | None = None
    status: ResultStatus = ResultStatus.NORMAL
    notes: str | None = None


class ResultBatchCreate(BaseModel):
    items: list[ResultItemCreate]


class ResultResponse(BaseModel):
    id: uuid.UUID
    competition_id: uuid.UUID
    competition_title: str | None = None
    athlete_id: uuid.UUID
    athlete_name: str | None = None
    athlete_organization: str | None = None
    athlete_municipality: str | None = None
    place: int | None = None
    score: float | None = None
    status: ResultStatus
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProtocolJudgeItem(BaseModel):
    judge_name: str
    position: str
    category: str | None = None


class ProtocolResponse(BaseModel):
    competition_id: uuid.UUID
    title: str
    discipline_name: str
    start_date: str
    end_date: str
    location: str | None
    level: str
    judges: list[ProtocolJudgeItem]
    results: list[ResultResponse]


ResultRead = ResultResponse
ProtocolEntry = ResultResponse


# Compatibility aliases
ResultRead = ResultResponse
ProtocolEntry = ResultResponse

