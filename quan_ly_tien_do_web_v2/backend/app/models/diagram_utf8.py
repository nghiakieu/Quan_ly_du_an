from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class Diagram(Base):
    __tablename__ = "diagrams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    objects = Column(Text, nullable=True)   # JSON string of objects
    
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True) # Allow null for transition
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Cache
    cached_progress_percent = Column(Float, nullable=True) # % tien do hoan thanh cua so do
    cached_target_value = Column(Float, nullable=True)     # Tong gia tri thiet ke
    cached_completed_value = Column(Float, nullable=True)  # Tong gia tri thuc te

    # Relationships
    project = relationship("Project", back_populates="diagrams")
    boq_items = relationship("BOQItem", back_populates="diagram", cascade="all, delete-orphan")
