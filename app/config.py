from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "jwt-auth-backend"
    access_token_minutes: int = 15
    refresh_token_days: int = 7

    max_failed_attempts: int = 5
    lockout_minutes: int = 15
    require_email_verification: bool = True
    email_verification_hours: int = 24
    password_reset_minutes: int = 60
    bcrypt_rounds: int = 12

    dev_expose_tokens: bool = False
    cors_origins: list[str] = [
        "http://localhost:4200",
        "http://localhost:3000",
        "http://127.0.0.1:4200",
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
