from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.api import auth, events, dashboards, alerts, reports, websocket, api_keys
from app.core.database import Base, engine
from app.core.config import settings
from app.models.invite import OrganizationInvite
from app.models.api_key import ApiKey

app = FastAPI(
    title="Wexa AI Analytics Platform",
    description="Production-grade AI Analytics Platform API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://wexaaiplatform.vercel.app",
        "https://wexaaiplatform-git-main-wexa.vercel.app",
        "https://wexaaiplatform-nuxhsk0w1-wexa.vercel.app",
        "https://wexaaiplatform-4xcesrop2-wexa.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        # Create pgvector extension if not exists
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(events.router, prefix="/api/events", tags=["Events"])
app.include_router(dashboards.router, prefix="/api/dashboards", tags=["Dashboards"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(api_keys.router, prefix="/api/keys", tags=["API Keys"])
app.include_router(websocket.router, prefix="/ws", tags=["WebSocket"])

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy"}