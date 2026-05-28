from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
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
limiter = Limiter(key_func=get_remote_address)


@router.post("/", response_model=EventOut, status_code=201)
@limiter.limit("100/minute")
async def ingest_event(
    request: Request,
    event_in: EventCreate,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_organization_from_auth)
):
    """Ingest a single event. Rate limited to 100 requests/minute per IP."""
    return await event_service.create_event(db, org_id, event_in)


@router.post("/batch", status_code=201)
@limiter.limit("20/minute")
async def ingest_events_batch(
    request: Request,
    events: List[EventCreate],
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_organization_from_auth)
):
    """Ingest a batch of up to 500 events in one request."""
    if len(events) > 500:
        raise HTTPException(status_code=400, detail="Batch size cannot exceed 500 events")

    created = []
    for event_in in events:
        event = await event_service.create_event(db, org_id, event_in)
        created.append(event.id)

    return {"detail": f"Successfully ingested {len(created)} events", "event_ids": created}


@router.post("/webhook", status_code=201)
@limiter.limit("60/minute")
async def webhook_receiver(
    request: Request,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_organization_from_auth)
):
    """
    Generic webhook receiver. Accepts any JSON payload and ingests it as an event.
    The payload is stored as-is in the event's payload field.
    Event type defaults to 'webhook' unless a 'event_type' key is present in the payload.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = body.pop("event_type", "webhook")
    event_in = EventCreate(event_type=event_type, payload=body)
    event = await event_service.create_event(db, org_id, event_in)
    return {"detail": "Webhook event ingested", "event_id": event.id}


@router.post("/upload-csv")
@limiter.limit("10/minute")
async def upload_csv(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_organization_from_auth)
):
    """Upload a CSV file. Must contain an 'event_name' column."""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    contents = await file.read()
    decoded = contents.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))

    events_created = 0
    for row in reader:
        if 'event_name' not in row:
            continue

        event_data = EventCreate(
            event_type=row.pop('event_name'),
            payload={k: v for k, v in row.items() if v}
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