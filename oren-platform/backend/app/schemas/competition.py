from pydantic import BaseModel
import uuid
from datetime import date, datetime
from typing import Optional, List
from app.schemas.discipline import DisciplineRead


class CompetitionTypeRead(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class CompetitionTypeCreate(BaseModel):
    name: str
    description: Optional[str] = None


class CalendarPlanRead(BaseModel):
    id: uuid.UUID
    name: str
    year: int

    class Config:
        from_attributes = True


class CalendarPlanCreate(BaseModel):
    name: str
    year: int


class CompetitionRead(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str] = None
    discipline_id: int
    discipline: Optional[DisciplineRead] = None
    start_date: date
    end_date: date
    location: Optional[str] = None
    format: str
    level: str
    type_id: Optional[uuid.UUID] = None
    competition_type: Optional[CompetitionTypeRead] = None
    age_group: Optional[str] = None
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    status: str

    calendar_plan_id: Optional[uuid.UUID] = None
    calendar_plan: Optional[CalendarPlanRead] = None
    calendar_plan_number: Optional[str] = None

    regulation_file_path: Optional[str] = None
    registration_deadline: Optional[datetime] = None

    applications_count: Optional[int] = 0
    results_count: Optional[int] = 0

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CompetitionCreate(BaseModel):
    title: str
    description: Optional[str] = None
    discipline_id: int
    start_date: date
    end_date: date
    location: Optional[str] = None
    format: str = "onsite"  # onsite, online, mixed
    level: str = "regional"  # championship_russia, first_russia, interregional, regional
    type_id: Optional[uuid.UUID] = None
    age_group: Optional[str] = None
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    calendar_plan_id: Optional[uuid.UUID] = None
    calendar_plan_number: Optional[str] = None
    regulation_file_path: Optional[str] = None
    registration_deadline: Optional[datetime] = None


class CompetitionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    discipline_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    location: Optional[str] = None
    format: Optional[str] = None
    level: Optional[str] = None
    type_id: Optional[uuid.UUID] = None
    age_group: Optional[str] = None
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    status: Optional[str] = None
    calendar_plan_id: Optional[uuid.UUID] = None
    calendar_plan_number: Optional[str] = None
    regulation_file_path: Optional[str] = None
    registration_deadline: Optional[datetime] = None


class CompetitionResponse(CompetitionRead):
    discipline_name: Optional[str] = None
    discipline_code: Optional[str] = None
    type_name: Optional[str] = None
    calendar_plan_name: Optional[str] = None


CompetitionTypeResponse = CompetitionTypeRead
CalendarPlanResponse = CalendarPlanRead
