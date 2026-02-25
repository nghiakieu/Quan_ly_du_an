from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    role = Column(String, default="viewer") # "admin", "editor", "viewer"

    # Relationships
    managed_projects = relationship("Project", back_populates="manager")
    project_memberships = relationship("ProjectUser", back_populates="user", cascade="all, delete-orphan")
