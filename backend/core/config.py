from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "BloomCare Maternal Risk Intelligence API"
    
    # Security
    SECRET_KEY: str = "a_very_secret_key_change_me_in_production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    ALGORITHM: str = "HS256"

    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "bloomcare_user"
    POSTGRES_PASSWORD: str = "bloomcare_pass"
    POSTGRES_DB: str = "bloomcare_db"
    POSTGRES_PORT: str = "5432"
    
    # LLM Settings
    OPENAI_API_KEY: Optional[str] = None
    BLOOMCARE_OPENAI_MODEL: str = "gpt-4o"
    BLOOMCARE_MOCK_LLM: bool = True

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        server = self.POSTGRES_SERVER.strip()
        user = self.POSTGRES_USER.strip()
        password = self.POSTGRES_PASSWORD.strip()
        port = self.POSTGRES_PORT.strip()
        database = self.POSTGRES_DB.strip()
        return f"postgresql://{user}:{password}@{server}:{port}/{database}"

settings = Settings()
