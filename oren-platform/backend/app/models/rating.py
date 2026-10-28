import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RatingSetting(Base):
    """Configurable rating points per competition level and place."""
    __tablename__ = "rating_settings"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    level: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)  # competition level enum value
    place_1_points: Mapped[int] = mapped_column(Integer, nullable=False)
    place_2_points: Mapped[int] = mapped_column(Integer, nullable=False)
    place_3_points: Mapped[int] = mapped_column(Integer, nullable=False)


class TeamRoster(Base):
    """Regional team roster for a season/discipline/age group."""
    __tablename__ = "team_rosters"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    season: Mapped[str] = mapped_column(String(20), nullable=False)  # e.g., "2025-2026"
    discipline_id: Mapped[int] = mapped_column(ForeignKey("disciplines.id"), nullable=False)
    age_group: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)

    # Relationships
    discipline: Mapped["Discipline"] = relationship("Discipline", lazy="selectin")
    members: Mapped[list["TeamRosterMember"]] = relationship("TeamRosterMember", back_populates="roster", lazy="selectin", cascade="all, delete-orphan")


class TeamRosterMember(Base):
    __tablename__ = "team_roster_members"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    roster_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("team_rosters.id"), nullable=False)
    athlete_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    rating_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="main")  # main, reserve

    roster: Mapped["TeamRoster"] = relationship("TeamRoster", back_populates="members")
    athlete: Mapped["User"] = relationship("User", lazy="selectin")
