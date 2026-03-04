from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Quan Ly Tien Do API"
    API_V1_STR: str = "/api/v1"
    
    # CORS Configuration - Simple list of allowed origins
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
    ]

    # Database
    SQLALCHEMY_DATABASE_URI: str = "sqlite:///./sql_app.db"

    class Config:
        case_sensitive = True

settings = Settings()
