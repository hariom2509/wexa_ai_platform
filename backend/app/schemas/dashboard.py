from pydantic import BaseModel
from typing import List, Dict, Any

class DashboardCreate(BaseModel):
    name: str
    widgets: List[Dict[str, Any]] = []

class DashboardOut(BaseModel):
    id: int
    name: str
    widgets: List[Dict[str, Any]]

    class Config:
        from_attributes = True