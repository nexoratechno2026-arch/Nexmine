from pydantic_settings import BaseSettings
from pydantic import EmailStr
from typing import Optional


class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite:///./nexmine.db"

    # JWT
    jwt_secret_key: str = "CHANGE_ME"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440  # 24h

    # Email / SMTP
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    smtp_from: str = "noreply@nexmine.io"
    smtp_starttls: bool = True

    # App
    app_name: str = "NexMine"
    frontend_url: str = "http://localhost:5173"

    # AI Layer (Phase 6)
    anthropic_api_key: Optional[str] = None

    class Config:
        env_file = "../.env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
