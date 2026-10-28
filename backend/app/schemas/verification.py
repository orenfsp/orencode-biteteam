from pydantic import BaseModel, EmailStr
from typing import Optional


class RequestVerificationCodeRequest(BaseModel):
    email: EmailStr
    purpose: str = "login"  # login, registration, email_verify, reset_password


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str
    purpose: str = "login"


class VerificationResponse(BaseModel):
    status: str
    message: str
    channels: list[str] = []
    expires_in_minutes: int = 10


class LoginWithCodeRequest(BaseModel):
    email: EmailStr
    code: str
