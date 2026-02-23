from sqlalchemy import Column, Integer, String, Float, DateTime
from app.db.database import Base
from datetime import datetime

class Block(Base):
    __tablename__ = "blocks"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)      # Số hiệu (e.g., C1-T1)
    category_name = Column(String)                      # Loại hạng mục
    pier = Column(String, nullable=True)                # Trụ
    span = Column(String, nullable=True)                # Nhịp
    segment = Column(String, nullable=True)             # Đốt/Đợt
    volume = Column(Float, nullable=True)               # Khối lượng
    unit = Column(String, default="m³")                 # Đơn vị
    unit_price = Column(Float, nullable=True)           # Đơn giá
    total_value = Column(Float, nullable=True)          # Tổng giá trị
    status = Column(Integer, default=0)                 # 0: Chưa, 1: Đang, 2: Xong
    completed_at = Column(DateTime, nullable=True)      # Ngày hoàn thành
    notes = Column(String, nullable=True)               # Ghi chú
