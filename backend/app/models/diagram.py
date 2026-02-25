from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class Diagram(Base):
    __tablename__ = "diagrams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    objects = Column(Text, nullable=True)   # JSON string of objects
    boq_data = Column(Text, nullable=True)  # JSON string of BOQ Data
    
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True) # Allow null for transition
    
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="diagrams")
