import uuid
from datetime import datetime, date
from sqlalchemy import String, Boolean, Date, DateTime, ForeignKey, Text, Enum as SAEnum, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.database import Base


class RoleEnum(str, enum.Enum):
    FEDERATION = "federation"
    ATHLETE = "athlete"
    COACH = "coach"
    JUDGE = "judge"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    municipality: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("organizations.id"), nullable=True)
    year_started: Mapped[int | None] = mapped_column(nullable=True)
    sport_preparation_stage: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Anti-doping
    anti_doping_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    anti_doping_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    anti_doping_cert_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Legal representative (for minors)
    legal_rep_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    legal_rep_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    legal_rep_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Personal data consent
    pd_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    pd_consent_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Disqualification
    is_disqualified: Mapped[bool] = mapped_column(Boolean, default=False)
    disqualification_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    disqualification_until: Mapped[date | None] = mapped_column(Date, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    roles: Mapped[list["UserRole"]] = relationship("UserRole", back_populates="user", lazy="selectin", cascade="all, delete-orphan")
    organization: Mapped["Organization | None"] = relationship("Organization", back_populates="users", lazy="selectin")
    rank_records: Mapped[list["RankRecord"]] = relationship("RankRecord", back_populates="athlete", lazy="selectin")
    judge_records: Mapped[list["JudgeCategoryRecord"]] = relationship("JudgeCategoryRecord", back_populates="judge", lazy="selectin")

    @property
    def available_roles(self) -> list[str]:
        return [
            r.role.value if hasattr(r.role, "value") else str(r.role)
            for r in self.roles
            if getattr(r, "status", "approved") == "approved"
        ]

    @property
    def pending_roles(self) -> list[str]:
        return [
            r.role.value if hasattr(r.role, "value") else str(r.role)
            for r in self.roles
            if getattr(r, "status", "approved") == "pending"
        ]

    @property
    def organization_name(self) -> str | None:
        return self.organization.name if self.organization else None

    @property
    def active_role(self) -> str | None:
        roles = self.available_roles
        if RoleEnum.FEDERATION.value in roles:
            return RoleEnum.FEDERATION.value
        if roles:
            return roles[0]
        pending = self.pending_roles
        if pending:
            return f"pending:{pending[0]}"
        return "pending"


class UserRole(Base):
    __tablename__ = "user_roles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    role: Mapped[str] = mapped_column(SAEnum(RoleEnum, native_enum=False), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="approved", nullable=False)
    requested_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="roles")
