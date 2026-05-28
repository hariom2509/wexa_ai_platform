from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime


class ReportCreate(BaseModel):
    name: str
    schedule: Optional[str] = None  # daily, weekly, monthly, or None for one-off


class ReportOut(BaseModel):
    id: int
    name: str
    data: Optional[Dict[str, Any]] = None
    schedule: Optional[str] = None
    next_run_at: Optional[datetime] = None
    last_run_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
