from pydantic import BaseModel
from typing import List, Dict, Any

class DashboardCreate(BaseModel):
    name: str
    widgets: List[Dict[str, Any]] = []
    is_public: bool = False

class DashboardOut(BaseModel):
    id: int
    name: str
    widgets: List[Dict[str, Any]]
    is_public: bool
    public_token: str | None = None

    class Config:
        from_attributes = True