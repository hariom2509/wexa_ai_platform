from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func, Float
from sqlalchemy.orm import relationship
from app.core.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), index=True)

    # Rule definition
    name = Column(String, nullable=False, default="Unnamed Alert")
    metric = Column(String, nullable=False)
    condition = Column(String, default=">")          # >, <, >=, <=, ==
    threshold = Column(Float, nullable=False)
    window_minutes = Column(Integer, default=10)     # evaluation time window

    # Notification config
    notification_channel = Column(String, default="in-app")  # in-app, email, webhook
    webhook_url = Column(String, nullable=True)

    # State
    status = Column(String, default="active")        # active, triggered, resolved, muted
    muted_until = Column(DateTime(timezone=True), nullable=True)
    triggered_at = Column(DateTime(timezone=True), nullable=True)
    triggered_value = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization", back_populates="alerts")