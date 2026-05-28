from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
import csv
import io
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.schemas.event import EventCreate, EventOut, SearchQuery
from app.services.event_service import event_service
from app.api.deps import get_current_user, get_organization_from_auth
from app.models.user import User

router = APIRouter()

@router.post("/", response_model=EventOut, status_code=201)
async def ingest_event(
    event_in: EventCreate,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_organization_from_auth)
):
    return await event_service.create_event(db, org_id, event_in)

@router.post("/upload-csv")
async def upload_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_organization_from_auth)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
        
    contents = await file.read()
    decoded = contents.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))
    
    events_created = 0
    for row in reader:
        # Expecting at least event_name and user_id in CSV
        if 'event_name' not in row:
            continue
            
        event_data = EventCreate(
            event_type=row.pop('event_name'),
            payload=row
        )
        await event_service.create_event(db, org_id, event_data)
        events_created += 1
        
    return {"detail": f"Successfully ingested {events_created} events from CSV"}

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