from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.db.database import Base

class Diagram(Base):
    __tablename__ = "diagrams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    objects = Column(Text, nullable=True)   # JSON string of objects
    boq_data = Column(Text, nullable=True)  # JSON string of BOQ Data
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
