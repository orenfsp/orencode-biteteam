import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Enum as SAEnum, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.database import Base


class CoachAthleteStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    PAUSED = "paused"
    ENDED = "ended"


class CoachAthlete(Base):
    """Link between coach and athlete with discipline and status tracking."""
    __tablename__ = "coach_athletes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    coach_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    athlete_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    discipline_id: Mapped[int] = mapped_column(ForeignKey("disciplines.id"), nullable=False)
    status: Mapped[str] = mapped_column(SAEnum(CoachAthleteStatus, native_enum=False), default=CoachAthleteStatus.PENDING)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    coach: Mapped["User"] = relationship("User", foreign_keys=[coach_id], lazy="selectin")
    athlete: Mapped["User"] = relationship("User", foreign_keys=[athlete_id], lazy="selectin")
    discipline: Mapped["Discipline"] = relationship("Discipline", lazy="selectin")

    @property
    def coach_name(self) -> str | None:
        return self.coach.full_name if self.coach else None

    @property
    def athlete_name(self) -> str | None:
        return self.athlete.full_name if self.athlete else None

    @property
    def discipline_name(self) -> str | None:
        return self.discipline.name if self.discipline else None
