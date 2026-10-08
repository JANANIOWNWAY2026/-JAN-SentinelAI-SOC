from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float
from sqlalchemy.orm import declarative_base
from datetime import datetime


Base = declarative_base()


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    rule = Column(String)
    risk_score = Column(Integer, default=0)
    status = Column(String, default="NEW")
    source_ip = Column(String)
    username = Column(String)
    ai_anomaly = Column(Boolean, default=False)
    ai_anomaly_score = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)