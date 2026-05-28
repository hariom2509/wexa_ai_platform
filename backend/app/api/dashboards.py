from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.schemas.dashboard import DashboardCreate, DashboardOut
from app.services.dashboard_service import dashboard_service
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

@router.post("/", response_model=DashboardOut, status_code=201)
async def create_dashboard(
    dashboard_in: DashboardCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return await dashboard_service.create_dashboard(db, current_user.organization_id, dashboard_in)
    except Exception as e:
        import traceback
        raise HTTPException(status_code=400, detail=f"Dashboard creation failed: {str(e)}\n{traceback.format_exc()}")

@router.get("/", response_model=List[DashboardOut])
async def list_dashboards(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await dashboard_service.get_dashboards(db, current_user.organization_id)

@router.get("/public/{token}", response_model=DashboardOut)
async def get_public_dashboard(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    return await dashboard_service.get_public_dashboard(db, token)

@router.get("/{dashboard_id}", response_model=DashboardOut)
async def get_dashboard(
    dashboard_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await dashboard_service.get_dashboard(db, current_user.organization_id, dashboard_id)

@router.put("/{dashboard_id}", response_model=DashboardOut)
async def update_dashboard(
    dashboard_id: int,
    dashboard_in: DashboardCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await dashboard_service.update_dashboard(db, current_user.organization_id, dashboard_id, dashboard_in)