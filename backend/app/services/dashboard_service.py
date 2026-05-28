from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from fastapi import HTTPException
import secrets

from app.models.dashboard import Dashboard
from app.schemas.dashboard import DashboardCreate

class DashboardService:
    async def create_dashboard(self, db: AsyncSession, org_id: int, dashboard_in: DashboardCreate) -> Dashboard:
        public_token = secrets.token_urlsafe(16) if dashboard_in.is_public else None
        dashboard = Dashboard(
            organization_id=org_id,
            name=dashboard_in.name,
            widgets=dashboard_in.widgets,
            is_public=dashboard_in.is_public,
            public_token=public_token
        )
        db.add(dashboard)
        await db.commit()
        await db.refresh(dashboard)
        return dashboard

    async def get_dashboards(self, db: AsyncSession, org_id: int) -> List[Dashboard]:
        result = await db.execute(
            select(Dashboard).where(Dashboard.organization_id == org_id).order_by(Dashboard.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_dashboard(self, db: AsyncSession, org_id: int, dashboard_id: int) -> Dashboard:
        result = await db.execute(
            select(Dashboard).where(Dashboard.id == dashboard_id, Dashboard.organization_id == org_id)
        )
        dashboard = result.scalars().first()
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        return dashboard

    async def update_dashboard(self, db: AsyncSession, org_id: int, dashboard_id: int, dashboard_in: DashboardCreate) -> Dashboard:
        dashboard = await self.get_dashboard(db, org_id, dashboard_id)
        dashboard.name = dashboard_in.name
        dashboard.widgets = dashboard_in.widgets
        
        if dashboard_in.is_public and not dashboard.is_public:
            dashboard.is_public = True
            dashboard.public_token = secrets.token_urlsafe(16)
        elif not dashboard_in.is_public:
            dashboard.is_public = False
            dashboard.public_token = None
            
        await db.commit()
        await db.refresh(dashboard)
        return dashboard

    async def get_public_dashboard(self, db: AsyncSession, public_token: str) -> Dashboard:
        result = await db.execute(
            select(Dashboard).where(Dashboard.public_token == public_token, Dashboard.is_public == True)
        )
        dashboard = result.scalars().first()
        if not dashboard:
            raise HTTPException(status_code=404, detail="Public dashboard not found")
        return dashboard

dashboard_service = DashboardService()