from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.schemas.alert import AlertCreate, AlertOut, AlertMute
from app.services.alert_service import alert_service
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()


@router.post("/", response_model=AlertOut, status_code=201)
async def create_alert(
    alert_in: AlertCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await alert_service.create_alert(db, current_user.organization_id, alert_in)


@router.get("/", response_model=List[AlertOut])
async def list_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await alert_service.get_alerts(db, current_user.organization_id)


@router.put("/{alert_id}/resolve", response_model=AlertOut)
async def resolve_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await alert_service.resolve_alert(db, current_user.organization_id, alert_id)


@router.put("/{alert_id}/mute", response_model=AlertOut)
async def mute_alert(
    alert_id: int,
    mute_in: AlertMute,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mute an alert for a specified number of minutes (default 30)."""
    return await alert_service.mute_alert(db, current_user.organization_id, alert_id, mute_in.minutes)


@router.put("/{alert_id}/trigger", response_model=AlertOut)
async def manually_trigger_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually trigger an alert for testing notification channels."""
    return await alert_service.trigger_alert(
        db, current_user.organization_id, alert_id, triggered_value=999.0
    )