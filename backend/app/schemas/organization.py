from pydantic import BaseModel, EmailStr
import uuid
from typing import Optional


class OrganizationRead(BaseModel):
    id: uuid.UUID
    name: str
    org_type: str
    municipality: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    details: Optional[str] = None

    class Config:
        from_attributes = True


class OrganizationCreate(BaseModel):
    name: str
    org_type: str  # school, university, sport_school, club, other
    municipality: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    details: Optional[str] = None


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    org_type: Optional[str] = None
    municipality: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    details: Optional[str] = None


class OrganizationResponse(OrganizationRead):
    members_count: int = 0
