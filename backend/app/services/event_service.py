from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text
from typing import List

from app.models.event import Event
from app.schemas.event import EventCreate
from app.services.ai_service import ai_service

class EventService:
    async def create_event(self, db: AsyncSession, org_id: int, event_in: EventCreate) -> Event:
        # In a real production system, this would be pushed to Celery.
        # For simplicity in this demo, we process synchronously.
        searchable_text = ai_service.construct_searchable_text(event_in.event_type, event_in.payload)
        embedding = ai_service.generate_embedding(searchable_text)
        
        event = Event(
            organization_id=org_id,
            event_type=event_in.event_type,
            payload=event_in.payload,
            searchable_text=searchable_text,
            embedding=embedding
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)

        # Broadcast the new event
        from app.core.websocket_manager import manager
        import json
        event_data = {
            "type": "new_event",
            "data": {
                "id": event.id,
                "event_type": event.event_type,
                "payload": event.payload,
                "created_at": event.created_at.isoformat() if event.created_at else None
            }
        }
        await manager.broadcast_to_org(json.dumps(event_data), org_id)

        return event

    async def get_events(self, db: AsyncSession, org_id: int, limit: int = 50) -> List[Event]:
        result = await db.execute(
            select(Event).where(Event.organization_id == org_id).order_by(Event.created_at.desc()).limit(limit)
        )
        return list(result.scalars().all())

    async def semantic_search(self, db: AsyncSession, org_id: int, query: str, limit: int = 10) -> List[Event]:
        # Generate embedding for the search query
        query_embedding = ai_service.generate_embedding(query)
        
        # Use pgvector's L2 distance operator (<->) to find nearest neighbors
        # We must cast the embedding list to a vector representation string or use the proper parameter
        result = await db.execute(
            select(Event)
            .where(Event.organization_id == org_id)
            .order_by(Event.embedding.l2_distance(query_embedding))
            .limit(limit)
        )
        return list(result.scalars().all())

event_service = EventService()