from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Quan Ly Du An API"
    API_V1_STR: str = "/api/v1"
    
    # CORS Configuration - Allow all origins for Vercel deployment
    BACKEND_CORS_ORIGINS: List[str] = ["*"]

    # Database
    SQLALCHEMY_DATABASE_URI: str = "sqlite:///./sql_app.db"

    # Auth
    SECRET_KEY: str = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7" # Should be random string in production
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
