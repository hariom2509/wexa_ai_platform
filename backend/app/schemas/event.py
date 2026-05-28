from pydantic import BaseModel
from typing import Dict, Any, List
from datetime import datetime

class EventCreate(BaseModel):
    event_type: str
    payload: Dict[str, Any]

class EventOut(BaseModel):
    id: int
    event_type: str
    payload: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True

class SearchQuery(BaseModel):
    query: str
    limit: int = 10