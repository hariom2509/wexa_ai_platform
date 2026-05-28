from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.models.alert import Alert
from app.schemas.alert import AlertCreate

class AlertService:
    async def create_alert(self, db: AsyncSession, org_id: int, alert_in: AlertCreate) -> Alert:
        alert = Alert(
            organization_id=org_id,
            metric=alert_in.metric,
            threshold=alert_in.threshold
        )
        db.add(alert)
        await db.commit()
        await db.refresh(alert)

        from app.core.websocket_manager import manager
        import json
        alert_data = {
            "type": "new_alert",
            "data": {
                "id": alert.id,
                "metric": alert.metric,
                "threshold": alert.threshold,
                "status": alert.status
            }
        }
        await manager.broadcast_to_org(json.dumps(alert_data), org_id)

        return alert

    async def get_alerts(self, db: AsyncSession, org_id: int) -> List[Alert]:
        result = await db.execute(
            select(Alert).where(Alert.organization_id == org_id).order_by(Alert.created_at.desc())
        )
        return list(result.scalars().all())

    async def resolve_alert(self, db: AsyncSession, org_id: int, alert_id: int) -> Alert:
        from fastapi import HTTPException
        result = await db.execute(
            select(Alert).where(Alert.id == alert_id, Alert.organization_id == org_id)
        )
        alert = result.scalars().first()
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        alert.status = "resolved"
        await db.commit()
        await db.refresh(alert)

        from app.core.websocket_manager import manager
        import json
        alert_data = {
            "type": "resolve_alert",
            "data": {
                "id": alert.id,
                "metric": alert.metric,
                "status": alert.status
            }
        }
        await manager.broadcast_to_org(json.dumps(alert_data), org_id)

        return alert

alert_service = AlertService()
