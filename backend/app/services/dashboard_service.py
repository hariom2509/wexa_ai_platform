from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from fastapi import HTTPException

from app.models.dashboard import Dashboard
from app.schemas.dashboard import DashboardCreate

class DashboardService:
    async def create_dashboard(self, db: AsyncSession, org_id: int, dashboard_in: DashboardCreate) -> Dashboard:
        dashboard = Dashboard(
            organization_id=org_id,
            name=dashboard_in.name,
            widgets=dashboard_in.widgets
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
        await db.commit()
        await db.refresh(dashboard)
        return dashboard

dashboard_service = DashboardService()