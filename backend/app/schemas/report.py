from pydantic import BaseModel
from typing import Dict, Any

class ReportCreate(BaseModel):
    name: str

class ReportOut(BaseModel):
    id: int
    name: str
    data: Dict[str, Any]

    class Config:
        from_attributes = True
