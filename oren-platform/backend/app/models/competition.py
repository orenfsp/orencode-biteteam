import uuid
from datetime import datetime, date
from sqlalchemy import String, Date, DateTime, ForeignKey, Text, Integer, Enum as SAEnum, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.database import Base


class CompetitionFormat(str, enum.Enum):
    ONSITE = "onsite"         # очное
    ONLINE = "online"         # онлайн
    MIXED = "mixed"           # смешанное


class CompetitionLevel(str, enum.Enum):
    CHAMPIONSHIP_RUSSIA = "championship_russia"       # Чемпионат России
    FIRST_RUSSIA = "first_russia"                     # Первенство России
    INTERREGIONAL = "interregional"                   # Межрегиональные (в т.ч. окружные)
    REGIONAL = "regional"                             # Региональные


class CompetitionStatus(str, enum.Enum):
    DRAFT = "draft"
    REGISTRATION_OPEN = "registration_open"
    REGISTRATION_CLOSED = "registration_closed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class CompetitionType(Base):
    __tablename__ = "competition_types"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)


class CalendarPlan(Base):
    __tablename__ = "calendar_plans"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)  # EKP / Regional
    year: Mapped[int] = mapped_column(Integer, nullable=False)


class Competition(Base):
    __tablename__ = "competitions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    discipline_id: Mapped[int] = mapped_column(ForeignKey("disciplines.id"), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    location: Mapped[str | None] = mapped_column(String(500), nullable=True)
    format: Mapped[str] = mapped_column(SAEnum(CompetitionFormat, native_enum=False), default=CompetitionFormat.ONSITE)
    level: Mapped[str] = mapped_column(SAEnum(CompetitionLevel, native_enum=False), nullable=False)
    type_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("competition_types.id"), nullable=True)
    age_group: Mapped[str | None] = mapped_column(String(100), nullable=True)
    min_age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(SAEnum(CompetitionStatus, native_enum=False), default=CompetitionStatus.DRAFT)

    # Calendar plan info
    calendar_plan_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("calendar_plans.id"), nullable=True)
    calendar_plan_number: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Regulation file
    regulation_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Deadlines
    registration_deadline: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    discipline: Mapped["Discipline"] = relationship("Discipline", lazy="selectin")
    competition_type: Mapped["CompetitionType | None"] = relationship("CompetitionType", lazy="selectin")
    calendar_plan: Mapped["CalendarPlan | None"] = relationship("CalendarPlan", lazy="selectin")
    applications: Mapped[list["Application"]] = relationship("Application", back_populates="competition", lazy="selectin", cascade="all, delete-orphan")
    results: Mapped[list["Result"]] = relationship("Result", back_populates="competition", lazy="selectin", cascade="all, delete-orphan")
    judge_assignments: Mapped[list["JudgeAssignment"]] = relationship("JudgeAssignment", back_populates="competition", lazy="selectin", cascade="all, delete-orphan")
