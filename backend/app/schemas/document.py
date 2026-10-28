import uuid
from datetime import datetime
from pydantic import BaseModel


class CertificateCreate(BaseModel):
    result_id: uuid.UUID


class CertificateResponse(BaseModel):
    id: uuid.UUID
    number: str
    athlete_id: uuid.UUID
    athlete_name: str | None = None
    competition_id: uuid.UUID
    competition_title: str | None = None
    place: int | None = None
    file_path: str | None = None
    qr_code_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PublicVerifyResponse(BaseModel):
    valid: bool
    number: str
    athlete_name: str
    competition_title: str
    discipline_name: str
    competition_date: str
    place: int | None
    status: str
    issued_at: str
    federation_name: str = "Федерация спортивного программирования Оренбургской области"


CertificateRead = CertificateResponse
CertificateVerifyResponse = PublicVerifyResponse


# Compatibility aliases
CertificateRead = CertificateResponse
CertificateVerifyResponse = PublicVerifyResponse

