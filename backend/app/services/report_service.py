from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from fastapi import HTTPException
from datetime import datetime, timezone, timedelta

from app.models.report import Report
from app.schemas.report import ReportCreate

from sqlalchemy import func
from app.models.event import Event
from app.models.alert import Alert


class ReportService:
    async def create_report(self, db: AsyncSession, org_id: int, report_in: ReportCreate) -> Report:
        # Aggregate real data from the database
        total_events = (await db.execute(
            select(func.count(Event.id)).where(Event.organization_id == org_id)
        )).scalar() or 0

        active_alerts = (await db.execute(
            select(func.count(Alert.id)).where(
                Alert.organization_id == org_id,
                Alert.status.in_(["active", "triggered"])
            )
        )).scalar() or 0

        event_types = dict((await db.execute(
            select(Event.event_type, func.count(Event.id))
            .where(Event.organization_id == org_id)
            .group_by(Event.event_type)
        )).all())

        data = {
            "status": "completed",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "metrics": {
                "total_events": total_events,
                "active_alerts": active_alerts,
                "events_by_type": event_types,
            }
        }

        # Calculate next_run_at if this is a scheduled report
        next_run_at = None
        if report_in.schedule == "daily":
            next_run_at = datetime.now(timezone.utc) + timedelta(days=1)
        elif report_in.schedule == "weekly":
            next_run_at = datetime.now(timezone.utc) + timedelta(weeks=1)
        elif report_in.schedule == "monthly":
            next_run_at = datetime.now(timezone.utc) + timedelta(days=30)

        report = Report(
            organization_id=org_id,
            name=report_in.name,
            data=data,
            schedule=report_in.schedule,
            last_run_at=datetime.now(timezone.utc),
            next_run_at=next_run_at,
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

    async def get_report(self, db: AsyncSession, org_id: int, report_id: int) -> Report:
        result = await db.execute(
            select(Report).where(Report.id == report_id, Report.organization_id == org_id)
        )
        report = result.scalars().first()
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        return report


report_service = ReportService()
