from pydantic import BaseModel

class AlertCreate(BaseModel):
    metric: str
    threshold: float

class AlertOut(BaseModel):
    id: int
    metric: str
    threshold: float
    status: str

    class Config:
        from_attributes = True
