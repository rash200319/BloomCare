from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
import os

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"

# Known insecure default — never use on a shared/production deploy.
DEMO_SECRET_KEY = "bloomcare-local-demo-only-change-me"


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "BloomCare Maternal Risk Intelligence API"

    # local | production — set BLOOMCARE_ENV=production on Railway after SECRET_KEY is set
    BLOOMCARE_ENV: str = "local"

    # When true, refuse to start with the demo SECRET_KEY
    BLOOMCARE_ENFORCE_SECRETS: bool = False

    SECRET_KEY: str = DEMO_SECRET_KEY
    # 8 hours (was 7 days). Override via ACCESS_TOKEN_EXPIRE_MINUTES.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8
    ALGORITHM: str = "HS256"

    ALLOWED_ORIGINS: str = ""

    # Hide /docs and /openapi.json when true
    BLOOMCARE_DISABLE_API_DOCS: bool = False

    # Local demos only: include otp_for_testing in forgot-password responses
    BLOOMCARE_EXPOSE_DEMO_OTP: bool = False

    # Login throttle (in-memory). Set MAX_ATTEMPTS=0 to disable.
    BLOOMCARE_LOGIN_MAX_ATTEMPTS: int = 10
    BLOOMCARE_LOGIN_LOCKOUT_MINUTES: int = 15

    # Opt-in PHI access audit table writes (safe off for demos)
    BLOOMCARE_AUDIT_LOG_ENABLED: bool = False

    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "bloomcare_user"
    POSTGRES_PASSWORD: str = "bloomcare_pass"
    POSTGRES_DB: str = "bloomcare_db"
    POSTGRES_PORT: str = "5432"

    # Railway Postgres plugin (and similar hosts) inject DATABASE_URL / POSTGRES_URL.
    DATABASE_URL: Optional[str] = None
    POSTGRES_URL: Optional[str] = None

    OPENAI_API_KEY: Optional[str] = None
    BLOOMCARE_OPENAI_MODEL: str = "gpt-4o"
    BLOOMCARE_MOCK_LLM: bool = True

    model_config = SettingsConfigDict(env_file=str(ENV_FILE), case_sensitive=True, extra="ignore")

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        for raw in (self.DATABASE_URL, self.POSTGRES_URL):
            if raw and raw.strip():
                uri = raw.strip()
                # SQLAlchemy expects postgresql://; Railway often provides postgres://
                if uri.startswith("postgres://"):
                    uri = "postgresql://" + uri[len("postgres://"):]
                return uri

        server = self.POSTGRES_SERVER.strip()
        user = self.POSTGRES_USER.strip()
        password = self.POSTGRES_PASSWORD.strip()
        port = self.POSTGRES_PORT.strip()
        database = self.POSTGRES_DB.strip()
        return f"postgresql://{user}:{password}@{server}:{port}/{database}"

    @property
    def is_using_demo_secret(self) -> bool:
        return (self.SECRET_KEY or "").strip() == DEMO_SECRET_KEY

    @property
    def is_deployed_environment(self) -> bool:
        if (self.BLOOMCARE_ENV or "").strip().lower() == "production":
            return True
        return bool(os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RENDER") or os.getenv("FLY_APP_NAME"))


settings = Settings()


def validate_security_settings() -> None:
    """Call at startup. Warns on demo secret; optionally refuses to boot."""
    import logging

    logger = logging.getLogger("bloomcare.security")
    if not settings.is_using_demo_secret:
        return

    msg = (
        "SECRET_KEY is the built-in demo default. "
        "Set a strong SECRET_KEY in the environment before any shared deploy. "
        "Then set BLOOMCARE_ENFORCE_SECRETS=true to fail closed."
    )
    if settings.BLOOMCARE_ENFORCE_SECRETS:
        raise RuntimeError(msg)

    if settings.is_deployed_environment:
        logger.error("SECURITY: %s", msg)
    else:
        logger.warning("SECURITY: %s", msg)
