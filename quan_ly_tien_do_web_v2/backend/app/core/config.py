from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Quan Ly Du An API"
    API_V1_STR: str = "/api/v1"
    
    # CORS - Production: set BACKEND_CORS_ORIGINS trong .env (VD: ["https://your-domain.com"])
    BACKEND_CORS_ORIGINS: List[str] = ["*"]

    # Database
    SQLALCHEMY_DATABASE_URI: str = "sqlite:///./sql_app.db"

    # AI
    GEMINI_API_KEY: str = ""

    # Auth - MUST override via .env in production
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    DEFAULT_ADMIN_PASSWORD: str
    DEFAULT_ADMIN_USERNAME: str = "NghiaKieu"
    DEFAULT_ADMIN_EMAIL: str = "admin@example.com"
    
    # SMTP Setup for Emails
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = "" # App Password
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
