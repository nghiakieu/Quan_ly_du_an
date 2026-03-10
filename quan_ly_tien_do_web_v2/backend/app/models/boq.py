from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base

class BOQItem(Base):
    __tablename__ = "boq_items"

    id = Column(Integer, primary_key=True, index=True)
    diagram_id = Column(Integer, ForeignKey("diagrams.id", ondelete="CASCADE"), index=True)
    
    # Core BOQ fields
    work_name = Column(String, nullable=False)
    unit = Column(String, nullable=True)
    design_qty = Column(Float, default=0.0)
    actual_qty = Column(Float, default=0.0)
    plan_qty = Column(Float, default=0.0)
    price = Column(Float, default=0.0)
    
    order = Column(Integer, default=0)
    external_id = Column(String, nullable=True) # Mã hiệu công việc

    # Relationships
    diagram = relationship("Diagram", back_populates="boq_items")
