from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.models.report import Report
from app.schemas.report import ReportCreate

from sqlalchemy import func
from app.models.event import Event
from app.models.alert import Alert
from datetime import datetime

class ReportService:
    async def create_report(self, db: AsyncSession, org_id: int, report_in: ReportCreate) -> Report:
        # Aggregate real data from the database
        total_events_query = await db.execute(select(func.count(Event.id)).where(Event.organization_id == org_id))
        total_events = total_events_query.scalar() or 0
        
        active_alerts_query = await db.execute(select(func.count(Alert.id)).where(Alert.organization_id == org_id, Alert.status == "active"))
        active_alerts = active_alerts_query.scalar() or 0
        
        event_types_query = await db.execute(select(Event.event_type, func.count(Event.id)).where(Event.organization_id == org_id).group_by(Event.event_type))
        event_types = dict(event_types_query.all())

        data = {
            "status": "completed",
            "generated_at": datetime.utcnow().isoformat(),
            "metrics": {
                "total_events": total_events,
                "active_alerts": active_alerts,
                "events_by_type": event_types
            }
        }

        report = Report(
            organization_id=org_id,
            name=report_in.name,
            data=data
        )
        db.add(report)
        await db.commit()
        await db.refresh(report)
        return report

    async def get_reports(self, db: AsyncSession, org_id: int) -> List[Report]:
        result = await db.execute(
            select(Report).where(Report.organization_id == org_id).order_by(Report.created_at.desc())
        )
        return list(result.scalars().all())

report_service = ReportService()
