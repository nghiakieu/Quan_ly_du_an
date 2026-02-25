from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    
    # v1.3: Extended project info
    investor = Column(String, nullable=True)        # Chu dau tu
    total_budget = Column(Float, nullable=True)      # Tong von dau tu
    start_date = Column(DateTime(timezone=True), nullable=True)  # Ngay khoi cong
    end_date = Column(DateTime(timezone=True), nullable=True)    # Ngay du kien hoan thanh
    
    # Manager ID (linked to user)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String, default="planning") # planning, active, on_hold, completed
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    manager = relationship("User", back_populates="managed_projects")
    diagrams = relationship("Diagram", back_populates="project", cascade="all, delete-orphan")
    members = relationship("ProjectUser", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
