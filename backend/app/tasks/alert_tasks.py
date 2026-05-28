"""
Alert evaluation Celery task.

Runs every 60 seconds (configured in celery_app.beat_schedule).
For each active alert rule, it counts matching events within the
configured time window and compares to the threshold using the
alert's condition operator. If the condition is met, the alert
transitions to "triggered" and notifications are dispatched.
"""
import asyncio
from datetime import datetime, timedelta, timezone

from app.tasks.celery_app import celery_app


CONDITION_OPS = {
    ">":  lambda a, b: a > b,
    "<":  lambda a, b: a < b,
    ">=": lambda a, b: a >= b,
    "<=": lambda a, b: a <= b,
    "==": lambda a, b: a == b,
}


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def evaluate_alerts(self):
    """Evaluate all non-resolved, non-muted alert rules against recent event data."""
    try:
        asyncio.run(_evaluate_alerts_async())
    except Exception as exc:
        raise self.retry(exc=exc)


async def _evaluate_alerts_async():
    import structlog
    from sqlalchemy.future import select
    from sqlalchemy import func, and_
    from app.core.database import AsyncSessionLocal
    from app.models.alert import Alert
    from app.models.event import Event
    from app.services.alert_service import alert_service

    log = structlog.get_logger()

    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)

        # Load all alerts that are not permanently resolved
        result = await db.execute(
            select(Alert).where(Alert.status.in_(["active", "triggered", "muted"]))
        )
        alerts = result.scalars().all()

        for alert in alerts:
            # Skip still-muted alerts
            if alert.status == "muted" and alert.muted_until and alert.muted_until > now:
                continue
            # Un-mute expired mutes
            if alert.status == "muted" and (not alert.muted_until or alert.muted_until <= now):
                alert.status = "active"
                await db.commit()

            window_start = now - timedelta(minutes=alert.window_minutes)

            # Count events matching the metric (event_type) in the time window
            count_result = await db.execute(
                select(func.count(Event.id)).where(
                    and_(
                        Event.organization_id == alert.organization_id,
                        Event.event_type == alert.metric,
                        Event.created_at >= window_start,
                    )
                )
            )
            current_value = float(count_result.scalar() or 0)

            # Evaluate condition
            op = CONDITION_OPS.get(alert.condition, CONDITION_OPS[">"])
            condition_met = op(current_value, alert.threshold)

            log.info(
                "alert_evaluated",
                alert_id=alert.id,
                metric=alert.metric,
                current_value=current_value,
                threshold=alert.threshold,
                condition=alert.condition,
                triggered=condition_met,
            )

            if condition_met and alert.status != "triggered":
                await alert_service.trigger_alert(db, alert.organization_id, alert.id, current_value)
            elif not condition_met and alert.status == "triggered":
                # Auto-resolve when condition clears
                alert.status = "active"
                await db.commit()