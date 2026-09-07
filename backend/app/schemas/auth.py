from pydantic import BaseModel, EmailStr, Field
from typing import Optional
import uuid


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: Optional[str] = Field(None, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    full_name: Optional[str]


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    message: str
