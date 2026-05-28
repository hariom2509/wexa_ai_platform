import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.api import auth, events, dashboards, alerts, reports, websocket, api_keys
from app.core.database import Base, engine
from app.core.config import settings
from app.models.invite import OrganizationInvite
from app.models.api_key import ApiKey

# Configure structlog
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ]
)

log = structlog.get_logger()

# Rate limiter (shared, using IP address)
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Wexa AI Analytics Platform",
    description="Production-grade AI Analytics Platform API",
    version="1.0.0"
)

# Register rate limit error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://wexaaiplatform.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Structured request logging middleware."""
    log.info("request_started", method=request.method, path=request.url.path)
    response = await call_next(request)
    log.info(
        "request_completed",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
    )
    return response


@app.on_event("startup")
async def startup():
    log.info("application_startup", environment=settings.ENVIRONMENT)

    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)

    # Auto-migration: add any newly added columns that may not exist yet
    migrations = [
        # Dashboard columns
        "ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS description VARCHAR",
        "ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE",
        "ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS public_token VARCHAR UNIQUE",
        # Alert new columns
        "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS name VARCHAR DEFAULT 'Unnamed Alert'",
        "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS condition VARCHAR DEFAULT '>'",
        "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS window_minutes INTEGER DEFAULT 10",
        "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS notification_channel VARCHAR DEFAULT 'in-app'",
        "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS webhook_url VARCHAR",
        "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ",
        "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS triggered_at TIMESTAMPTZ",
        "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS triggered_value FLOAT",
        # Report new columns
        "ALTER TABLE reports ADD COLUMN IF NOT EXISTS schedule VARCHAR",
        "ALTER TABLE reports ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ",
        "ALTER TABLE reports ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ",
    ]

    async with engine.connect() as conn:
        for stmt in migrations:
            try:
                await conn.execute(text(stmt))
                await conn.commit()
            except Exception as e:
                log.warning("migration_skipped", statement=stmt, reason=str(e))

    log.info("startup_complete")


app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(events.router, prefix="/api/events", tags=["Events"])
app.include_router(dashboards.router, prefix="/api/dashboards", tags=["Dashboards"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(api_keys.router, prefix="/api/keys", tags=["API Keys"])
app.include_router(websocket.router, prefix="/ws", tags=["WebSocket"])


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}