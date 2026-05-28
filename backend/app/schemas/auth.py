from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    organization_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: str
    organization_id: int

    class Config:
        from_attributes = True

class InviteCreate(BaseModel):
    email: EmailStr
    role: str = "viewer"

class InviteAccept(BaseModel):
    token: str
    password: str

class ApiKeyCreate(BaseModel):
    name: str

class ApiKeyOut(BaseModel):
    id: int
    name: str
    prefix: str
    raw_key: str | None = None
    created_at: datetime | None = None
    last_used_at: datetime | None = None
    
    class Config:
        from_attributes = True