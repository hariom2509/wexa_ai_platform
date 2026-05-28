from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.schemas.report import ReportCreate, ReportOut
from app.services.report_service import report_service
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()


@router.post("/", response_model=ReportOut, status_code=201)
async def create_report(
    report_in: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a report. If `schedule` is set to 'daily', 'weekly', or 'monthly',
    the Celery Beat task will regenerate it automatically on the configured schedule.
    """
    return await report_service.create_report(db, current_user.organization_id, report_in)


@router.get("/", response_model=List[ReportOut])
async def list_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await report_service.get_reports(db, current_user.organization_id)


@router.get("/{report_id}", response_model=ReportOut)
async def get_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await report_service.get_report(db, current_user.organization_id, report_id)