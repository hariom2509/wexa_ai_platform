from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.schemas.event import EventCreate, EventOut, SearchQuery
from app.services.event_service import event_service
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

@router.post("/", response_model=EventOut, status_code=201)
async def ingest_event(
    event_in: EventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await event_service.create_event(db, current_user.organization_id, event_in)

@router.get("/", response_model=List[EventOut])
async def list_events(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await event_service.get_events(db, current_user.organization_id, limit)

@router.post("/search", response_model=List[EventOut])
async def search_events(
    query: SearchQuery,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await event_service.semantic_search(db, current_user.organization_id, query.query, query.limit)