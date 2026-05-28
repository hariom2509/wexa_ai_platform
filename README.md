# Wexa AI Analytics Platform

A production-grade real-time analytics & reporting SaaS platform — a lightweight Mixpanel/Metabase clone built for the AI Engineer technical assessment.

**Live Demo:**
- Frontend: https://wexaaiplatform.vercel.app
- Backend API: https://wexaaiplatform-production.up.railway.app/docs

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Vercel)                    │
│  Next.js 14 · TypeScript · Recharts · WebSocket Client  │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS / WSS
┌────────────────────▼────────────────────────────────────┐
│               Backend API (Railway)                      │
│  FastAPI · Uvicorn · SQLAlchemy 2.0 async · Pydantic v2 │
│  slowapi rate limiting · structlog · WebSocket manager   │
└────────┬────────────────────────┬───────────────────────┘
         │                        │
┌────────▼───────┐    ┌──────────▼──────────────────────┐
│  PostgreSQL    │    │  Redis                           │
│  (Railway)     │    │  Celery broker · task results    │
│  pgvector ext  │    │  Rate limit counters             │
└────────────────┘    └──────────┬──────────────────────┘
                                  │
                     ┌────────────▼────────────────────┐
                     │  Celery Worker + Beat (Railway) │
                     │  · evaluate_alerts (every 60s)  │
                     │  · generate_scheduled_reports    │
                     └─────────────────────────────────┘
```

### Design Pattern
Clean architecture with layered separation:
```
HTTP Request → Router (api/) → Service (services/) → Model (models/) → PostgreSQL
```
All database access goes through SQLAlchemy async sessions injected via FastAPI `Depends`.

---

## Features

### 🔐 Authentication & Multi-Tenancy
- Email/password sign-up with bcrypt hashing via `passlib`
- Short-lived JWT access tokens (30 min) + refresh token in HTTP-only cookie (7 days)
- Role hierarchy: **Owner → Admin → Analyst → Viewer** enforced by `RoleChecker` dependency
- Organization creation during signup; invite-based team onboarding with 3-day expiring tokens
- All data queries are isolated by `organization_id` at the database query layer

### 📊 Data Ingestion
- `POST /api/events/` — single event ingestion
- `POST /api/events/batch` — batch ingestion up to 500 events
- `POST /api/events/webhook` — generic webhook receiver (Slack/GitHub/Stripe compatible)
- `POST /api/events/upload-csv` — CSV upload (requires `event_name` column)
- Rate limiting via `slowapi`: 100/min (single), 20/min (batch), 10/min (CSV)
- AI-powered semantic search via pgvector embeddings (sentence-transformers)
- API key management: generate, revoke, and **rotate** keys per organization

### 📈 Dashboards
- Create named dashboards with JSONB widget storage
- Public sharing via unique read-only token (`/public/{token}`)
- Auto-refresh at 30s / 1m / 5m intervals

### 🚨 Alerts & Notifications
- Configurable rules: `metric` + `condition` (`>`, `<`, `>=`, `<=`, `==`) + `threshold` + `window_minutes`
- **Celery Beat** evaluates all active rules every 60 seconds
- Notification channels: **in-app** (WebSocket), **email** (logged), **webhook** (Slack-compatible HTTP POST)
- Alert statuses: `active` → `triggered` → `resolved`, and `muted`
- Mute alerts for configurable number of minutes (`PUT /alerts/{id}/mute`)
- Manual test trigger via `PUT /alerts/{id}/trigger`
- Auto-resolve when the condition clears

### 📋 Scheduled Reports
- One-off or scheduled reports: **daily**, **weekly**, **monthly**
- Celery Beat regenerates scheduled reports automatically
- Download reports as JSON

### ⚡ Real-Time
- WebSocket live event stream and alert push to all org members
- Exponential backoff reconnection (1s → 2s → 4s … capped at 30s)

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker (for PostgreSQL + Redis)

### 1. Start infrastructure

```bash
docker-compose up -d db redis
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your DATABASE_URL and SECRET_KEY
uvicorn app.main:app --reload --port 8000
```

Start Celery worker and beat scheduler (separate terminals):
```bash
celery -A app.tasks.celery_app worker --loglevel=info
celery -A app.tasks.celery_app beat --loglevel=info
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000/api
npm run dev
```

### 4. Run Tests

```bash
cd backend
pip install aiosqlite  # SQLite async driver for test DB
pytest -v
```

---

## Environment Variables

### Backend (`.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL async URL (`postgresql+asyncpg://...`) |
| `REDIS_URL` | Redis URL (`redis://localhost:6379/0`) |
| `SECRET_KEY` | JWT signing secret (min 32 chars) |
| `ALGORITHM` | JWT algorithm (default: `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime (default: `30`) |
| `ENVIRONMENT` | `development` or `production` |

### Frontend (`.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |

---

## API Reference

Full interactive docs available at `/docs` (Swagger UI) or `/redoc`.

Key endpoints:
- `POST /api/auth/register` — Register + create org
- `POST /api/auth/login` — Login, get JWT + refresh cookie
- `POST /api/events/batch` — Ingest up to 500 events
- `POST /api/events/webhook` — Webhook receiver
- `GET /api/events/?limit=50` — List recent events
- `POST /api/alerts/` — Create alert rule
- `PUT /api/alerts/{id}/mute` — Mute for N minutes
- `POST /api/keys/{id}/rotate` — Rotate API key
- `POST /api/reports/` — Generate report (with optional schedule)
- `WS /ws/{org_id}` — WebSocket live stream

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Recharts |
| Backend | FastAPI, Python 3.11, Pydantic v2 |
| Database | PostgreSQL + pgvector (SQLAlchemy 2.0 async) |
| Task Queue | Celery + Redis + Celery Beat |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Rate Limiting | slowapi |
| Logging | structlog |
| AI/Embeddings | sentence-transformers (all-MiniLM-L6-v2) |
| Tests | pytest + pytest-asyncio + httpx |
| Deploy | Vercel (frontend) + Railway (backend + worker + DB + Redis) |