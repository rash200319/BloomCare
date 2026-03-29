from pydantic_settings import BaseSettings
from pathlib import Path
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "BloomCare API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    # By default uses SQLite for quick local development
    # Set DATABASE_URL environment variable to use PostgreSQL:
    #   postgresql://username:password@localhost:5432/bloomcare
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "127.0.0.1")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "bloomcare")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))
    
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./bloomcare.db"
    )

    # JWT
    SECRET_KEY: str = "bloomcare-super-secret-key-change-in-production-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ML / AI
    BLOOMCARE_MOCK_LLM: bool = True

    # Paths to ML models (relative to project root)
    MODEL_BASE_PATH: Path = Path(__file__).resolve().parents[3]
    STAGE1_MODEL_PATH: str = "stage1_general_risk_screener.pkl"
    STAGE2_PREECLAMPSIA_MODEL_PATH: str = "models/stage2_diagnostic.pkl"
    STAGE2_GDM_MODEL_PATH: str = "models/stage2_gdm_diagnostic.pkl"
    STAGE2_PRETERM_MODEL_PATH: str = "models/stage2_preterm_diagnostic.pkl"
    GDM_IMPUTER_PATH: str = "models/gdm_imputer.pkl"
    PRETERM_IMPUTER_PATH: str = "models/preterm_imputer.pkl"

    # CORS
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
