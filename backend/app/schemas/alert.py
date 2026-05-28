from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AlertCreate(BaseModel):
    name: str = "Unnamed Alert"
    metric: str
    condition: str = ">"                  # >, <, >=, <=, ==
    threshold: float
    window_minutes: int = 10
    notification_channel: str = "in-app"  # in-app, email, webhook
    webhook_url: Optional[str] = None


class AlertMute(BaseModel):
    minutes: int = 30


class AlertOut(BaseModel):
    id: int
    name: str
    metric: str
    condition: str
    threshold: float
    window_minutes: int
    notification_channel: str
    webhook_url: Optional[str] = None
    status: str
    muted_until: Optional[datetime] = None
    triggered_at: Optional[datetime] = None
    triggered_value: Optional[float] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
