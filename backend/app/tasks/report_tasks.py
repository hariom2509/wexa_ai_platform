"""
Report generation Celery tasks.

Runs on a schedule configured in celery_app.beat_schedule:
  - Daily reports: every day at 7 AM UTC
  - Weekly reports: every Monday at 7 AM UTC
  - Monthly reports: 1st of each month at 7 AM UTC
"""
import asyncio
from app.tasks.celery_app import celery_app


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def generate_scheduled_reports(self, schedule_type: str):
    """Generate all reports with the given schedule type."""
    try:
        asyncio.run(_generate_scheduled_reports_async(schedule_type))
    except Exception as exc:
        raise self.retry(exc=exc)


async def _generate_scheduled_reports_async(schedule_type: str):
    import structlog
    from datetime import datetime, timezone, timedelta
    from sqlalchemy.future import select
    from sqlalchemy import func
    from app.core.database import AsyncSessionLocal
    from app.models.report import Report
    from app.models.event import Event
    from app.models.alert import Alert
    from app.schemas.report import ReportCreate

    log = structlog.get_logger()

    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)

        # Find all reports with this schedule
        result = await db.execute(
            select(Report).where(Report.schedule == schedule_type)
        )
        scheduled_reports = result.scalars().all()

        for report in scheduled_reports:
            # Check if it's time to run
            if report.next_run_at and report.next_run_at > now:
                continue  # Not yet time

            log.info("generating_scheduled_report", report_id=report.id, schedule=schedule_type)

            # Aggregate data for the report
            total_events = (await db.execute(
                select(func.count(Event.id)).where(Event.organization_id == report.organization_id)
            )).scalar() or 0

            active_alerts = (await db.execute(
                select(func.count(Alert.id)).where(
                    Alert.organization_id == report.organization_id,
                    Alert.status.in_(["active", "triggered"])
                )
            )).scalar() or 0

            event_types = dict((await db.execute(
                select(Event.event_type, func.count(Event.id))
                .where(Event.organization_id == report.organization_id)
                .group_by(Event.event_type)
            )).all())

            report.data = {
                "status": "completed",
                "generated_at": now.isoformat(),
                "schedule": schedule_type,
                "metrics": {
                    "total_events": total_events,
                    "active_alerts": active_alerts,
                    "events_by_type": event_types,
                }
            }
            report.last_run_at = now

            # Schedule next run
            if schedule_type == "daily":
                report.next_run_at = now + timedelta(days=1)
            elif schedule_type == "weekly":
                report.next_run_at = now + timedelta(weeks=1)
            elif schedule_type == "monthly":
                report.next_run_at = now + timedelta(days=30)

            await db.commit()
            log.info("scheduled_report_generated", report_id=report.id)