import uuid
from datetime import datetime
from pydantic import BaseModel


class RatingEventBreakdown(BaseModel):
    competition_id: uuid.UUID
    competition_title: str
    competition_level: str
    place: int | None
    points_earned: int


class RatingAthleteItem(BaseModel):
    athlete_id: uuid.UUID
    athlete_name: str
    organization_name: str | None = None
    municipality: str | None = None
    age_group: str | None = None
    rank: str | None = None
    raw_points: int
    multiplier_applied: bool = False
    final_points: int
    starts_count: int
    top3_count: int
    events: list[RatingEventBreakdown] = []


class RatingResponse(BaseModel):
    season: str
    discipline_id: int
    discipline_name: str
    athletes: list[RatingAthleteItem]


class TeamRosterMemberItem(BaseModel):
    athlete_id: uuid.UUID
    athlete_name: str | None = None
    birth_date: str | None = None
    organization_name: str | None = None
    municipality: str | None = None
    rank: str | None = None
    rating_score: int | None = None
    status: str = "main"  # main, reserve


class TeamRosterCreate(BaseModel):
    season: str
    discipline_id: int
    age_group: str | None = None
    members: list[dict]  # list of {"athlete_id": uuid, "rating_score": int, "status": "main"/"reserve"}


class TeamRosterResponse(BaseModel):
    id: uuid.UUID
    season: str
    discipline_id: int
    discipline_name: str | None = None
    age_group: str | None = None
    created_at: datetime
    created_by: uuid.UUID
    members: list[TeamRosterMemberItem] = []

    model_config = {"from_attributes": True}


class RatingSettingRead(BaseModel):
    id: uuid.UUID
    level: str
    place_1_points: int
    place_2_points: int
    place_3_points: int

    model_config = {"from_attributes": True}


class RatingSettingUpdate(BaseModel):
    place_1_points: int | None = None
    place_2_points: int | None = None
    place_3_points: int | None = None


# Compatibility aliases
TeamRosterRead = TeamRosterResponse

