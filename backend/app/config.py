import os
from pydantic_settings import BaseSettings
from functools import lru_cache


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DB_FILE = os.path.join(BASE_DIR, "fsp.db").replace("\\", "/")


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Единая цифровая платформа ФСП Оренбургской области"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database: defaults to SQLite for zero-config run, can be overridden via DATABASE_URL
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{DEFAULT_DB_FILE}")
    DATABASE_URL_SYNC: str = os.getenv("DATABASE_URL_SYNC", f"sqlite:///{DEFAULT_DB_FILE}")

    # JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-change-in-production-orencode2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Telegram Bot
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")

    # File storage
    UPLOAD_DIR: str = "uploads"
    GENERATED_DOCS_DIR: str = "generated_docs"

    # Base URL for QR codes & public links
    BASE_URL: str = os.getenv("BASE_URL", "http://localhost:8000")

    model_config = {
        "env_file": ".env",
        "extra": "ignore",
        "case_sensitive": True,
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
