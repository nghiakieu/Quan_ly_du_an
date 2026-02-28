from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Quan Ly Du An API"
    API_V1_STR: str = "/api/v1"
    
    # CORS Configuration - Whitelist allowed origins
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
    ]

    # Database
    SQLALCHEMY_DATABASE_URI: str = "sqlite:///./sql_app.db"

    # AI
    GEMINI_API_KEY: str = ""

    # Auth - MUST override via .env in production
    SECRET_KEY: str = "change-me-in-production-use-env-file"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
