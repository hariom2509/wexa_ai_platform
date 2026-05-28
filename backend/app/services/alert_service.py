from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_
from typing import List
from fastapi import HTTPException
from datetime import datetime, timedelta, timezone
import httpx

from app.models.alert import Alert
from app.models.event import Event
from app.schemas.alert import AlertCreate, AlertMute


class AlertService:
    async def create_alert(self, db: AsyncSession, org_id: int, alert_in: AlertCreate) -> Alert:
        alert = Alert(
            organization_id=org_id,
            name=alert_in.name,
            metric=alert_in.metric,
            condition=alert_in.condition,
            threshold=alert_in.threshold,
            window_minutes=alert_in.window_minutes,
            notification_channel=alert_in.notification_channel,
            webhook_url=alert_in.webhook_url,
        )
        db.add(alert)
        await db.commit()
        await db.refresh(alert)

        # Broadcast in-app notification
        from app.core.websocket_manager import manager
        import json
        await manager.broadcast_to_org(json.dumps({
            "type": "new_alert",
            "data": {
                "id": alert.id,
                "name": alert.name,
                "metric": alert.metric,
                "threshold": alert.threshold,
                "status": alert.status
            }
        }), org_id)

        return alert

    async def get_alerts(self, db: AsyncSession, org_id: int) -> List[Alert]:
        result = await db.execute(
            select(Alert).where(Alert.organization_id == org_id).order_by(Alert.created_at.desc())
        )
        return list(result.scalars().all())

    async def resolve_alert(self, db: AsyncSession, org_id: int, alert_id: int) -> Alert:
        alert = await self._get_alert_or_404(db, org_id, alert_id)
        alert.status = "resolved"
        await db.commit()
        await db.refresh(alert)

        from app.core.websocket_manager import manager
        import json
        await manager.broadcast_to_org(json.dumps({
            "type": "resolve_alert",
            "data": {"id": alert.id, "metric": alert.metric, "status": alert.status}
        }), org_id)

        return alert

    async def mute_alert(self, db: AsyncSession, org_id: int, alert_id: int, minutes: int) -> Alert:
        alert = await self._get_alert_or_404(db, org_id, alert_id)
        muted_until = datetime.now(timezone.utc) + timedelta(minutes=minutes)
        alert.muted_until = muted_until
        alert.status = "muted"
        await db.commit()
        await db.refresh(alert)
        return alert

    async def trigger_alert(
        self, db: AsyncSession, org_id: int, alert_id: int, triggered_value: float
    ) -> Alert:
        """Manually trigger an alert (used by Celery evaluation task)."""
        alert = await self._get_alert_or_404(db, org_id, alert_id)

        # Check if mute period has passed
        now = datetime.now(timezone.utc)
        if alert.muted_until and alert.muted_until > now:
            return alert  # Still muted — skip

        alert.status = "triggered"
        alert.triggered_at = now
        alert.triggered_value = triggered_value
        await db.commit()
        await db.refresh(alert)

        # Send notification based on channel
        await self._send_notification(alert, triggered_value)

        from app.core.websocket_manager import manager
        import json
        await manager.broadcast_to_org(json.dumps({
            "type": "alert_triggered",
            "data": {
                "id": alert.id,
                "name": alert.name,
                "metric": alert.metric,
                "triggered_value": triggered_value,
                "threshold": alert.threshold,
                "status": "triggered"
            }
        }), org_id)

        return alert

    async def _get_alert_or_404(self, db: AsyncSession, org_id: int, alert_id: int) -> Alert:
        result = await db.execute(
            select(Alert).where(Alert.id == alert_id, Alert.organization_id == org_id)
        )
        alert = result.scalars().first()
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")
        return alert

    async def _send_notification(self, alert: Alert, triggered_value: float):
        """Send email or webhook notification when alert is triggered."""
        message = (
            f"🚨 Alert Triggered: '{alert.name}'\n"
            f"Metric '{alert.metric}' = {triggered_value} "
            f"(threshold: {alert.condition} {alert.threshold})"
        )

        if alert.notification_channel == "webhook" and alert.webhook_url:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    # Slack-compatible webhook payload
                    payload = {
                        "text": message,
                        "attachments": [{
                            "color": "danger",
                            "fields": [
                                {"title": "Metric", "value": alert.metric, "short": True},
                                {"title": "Triggered Value", "value": str(triggered_value), "short": True},
                                {"title": "Threshold", "value": f"{alert.condition} {alert.threshold}", "short": True},
                            ]
                        }]
                    }
                    await client.post(alert.webhook_url, json=payload)
            except Exception as e:
                import structlog
                log = structlog.get_logger()
                log.warning("webhook_notification_failed", alert_id=alert.id, error=str(e))

        elif alert.notification_channel == "email":
            # Log mock email — real SMTP would use aiosmtplib
            import structlog
            log = structlog.get_logger()
            log.info("mock_email_notification", alert_id=alert.id, message=message)


alert_service = AlertService()
