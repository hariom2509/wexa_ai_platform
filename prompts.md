# LLM Validation & Reasoning

This document outlines how I used LLM assistance during the design and implementation of this project — including the specific questions I asked, the reasoning I applied to validate the output, and the final engineering decisions I made.

---

## 1. Architectural Reasoning & Trade-off Analysis

### Database & Infrastructure Stack

I started by asking: *"Compare Kafka + MongoDB + Pinecone vs PostgreSQL + Redis for a take-home SaaS analytics platform — what are the trade-offs on operational complexity, query performance, and development speed?"*

The response confirmed my suspicion: Kafka adds broker management, consumer group coordination, and partition tuning. Pinecone is an external managed service that introduces network latency and cost for every vector search call. MongoDB's schema flexibility is valuable only when the data shape is genuinely unknown — but my event schema was already well-defined via Pydantic models.

**My decision**: I went with **PostgreSQL + pgvector + Redis**. PostgreSQL handles relational data (users, orgs, alerts), JSONB payloads (event metadata, widget configs), and vector similarity search — all in one service. Redis handles Celery task brokering and rate limit counters. This cuts the infrastructure from 4 services down to 2 without losing any capability I actually needed.

### Task Queue Design

I asked: *"Should I use FastAPI BackgroundTasks or Celery + Redis for embedding generation and scheduled report jobs?"*

The answer clarified that FastAPI `BackgroundTasks` run inside the same Uvicorn process — if a task is CPU-bound (like running sentence-transformer embeddings) it blocks the async event loop and tanks API throughput for all other requests.

**My decision**: I chose **Celery with a dedicated worker process** to isolate heavy computation. For scheduled jobs (alert evaluation every minute, daily/weekly/monthly reports), I used **Celery Beat** instead of a host cron job because Beat is process-aware, retryable, and deploys cleanly as a separate Railway service.

---

## 2. Schema & Model Design

### Alert Rule Design

I asked: *"What fields does a production-grade alert rule model need to support threshold evaluation, muting, and multi-channel notifications?"*

Based on the response, I decided to include: `condition` (operator: `>`, `<`, `>=`, `<=`, `==`), `window_minutes` (time-boxed evaluation window), `notification_channel`, `webhook_url`, `muted_until`, `triggered_at`, and `triggered_value`.

I specifically chose `muted_until` as a `TIMESTAMPTZ` timestamp rather than a boolean `is_muted` flag — this way the alert automatically un-mutes when `now() > muted_until` without needing a separate scheduled task to flip the flag back.

**My decision**: I wired the auto-unmute logic directly into the Celery `evaluate_alerts` task, so every evaluation cycle checks if the mute window has expired before deciding whether to skip or evaluate the rule.

### Embedding Strategy

I asked: *"How do I avoid reloading a sentence-transformer model on every API request in a FastAPI async application?"*

The answer suggested loading the model at module import time as a global singleton.

I validated this is safe for a single-worker deployment (Railway runs one Uvicorn process). For multi-worker scenarios, each worker loads the model once at startup — ~90MB per process for `all-MiniLM-L6-v2`, which is acceptable overhead at this scale.

**My decision**: I used `sentence-transformers` locally rather than calling the OpenAI Embeddings API. This eliminates external API dependency, network latency, and per-call cost for a demo system where I control the entire stack.

---

## 3. Security Decisions

### JWT + Refresh Token

I asked: *"What are the correct cookie flags for a refresh token in a production Next.js + FastAPI setup?"*

The response confirmed: `HttpOnly` prevents JavaScript access (mitigates XSS), `Secure` ensures it only transmits over HTTPS, `SameSite=Lax` blocks CSRF attacks while allowing normal top-level navigation flows like OAuth redirects.

**My decision**: I implemented stateless refresh tokens (not stored in DB). I noted the production upgrade path would be a `refresh_token_blacklist` Redis set to support explicit revocation on logout — documented in the README but out of scope for this assessment.

### API Key Hashing

I asked: *"What's the right way to store API keys so that a DB breach doesn't expose live credentials?"*

The answer: store only a SHA-256 hash, never the raw key. Return the raw key exactly once on creation.

**My implementation**: I store `key_hash = hashlib.sha256(raw_key.encode()).hexdigest()` alongside a `prefix` (first 8 chars, stored plaintext) so users can identify their keys in the UI without the secret being exposed.

For key rotation, I mark the old key `is_active = False` in the same DB flush before committing the new key — ensuring there is zero window where both keys are simultaneously valid.

### Rate Limiting

I asked: *"What's the idiomatic library for per-IP rate limiting in a FastAPI + Starlette app?"*

The answer pointed me to `slowapi` (a Starlette port of Flask-Limiter) with a Redis backend for distributed state across multiple processes.

**My decision**: I applied asymmetric limits by intent — stricter on bulk operations (`20/min` batch, `10/min` CSV) to prevent data flooding, looser on single-event ingestion (`100/min`) to support high-frequency SDKs sending individual events.

---

## 4. Real-Time Architecture

### WebSocket vs SSE

I asked: *"Should I use Server-Sent Events or WebSockets for the live event stream feature?"*

SSE is simpler (one-directional, works over plain HTTP) but WebSocket is required here because the client needs to identify its org during the handshake (so the server knows which org channel to subscribe it to).

**My decision**: I chose WebSocket with a `ConnectionManager` that maintains `Dict[int, List[WebSocket]]` — one list of active sockets per `org_id`. Every event and alert broadcast is scoped to the correct org, enforcing the multi-tenant isolation model at the real-time layer too.

### Reconnection Strategy

I asked: *"What's the best reconnect strategy for a WebSocket client in a Next.js app?"*

The initial suggestion was a simple 3-second fixed retry. I pushed back on this — a fixed retry causes a thundering herd problem if the backend restarts and all connected clients try to reconnect simultaneously.

**My decision**: I implemented **exponential backoff** — starts at 1 second, doubles on each failure, caps at 30 seconds. The delay resets to 1 second on every successful reconnect. This spreads reconnection load naturally across time.

---

## 5. Celery Alert Evaluation

I asked: *"Write a Celery periodic task that evaluates alert rules against a time-series PostgreSQL table."*

The generated task used `COUNT(*)` of events matching `event_type = alert.metric` within a rolling time window.

Before accepting it, I validated and improved several things:
1. **Timezone correctness**: Replaced `datetime.utcnow()` (deprecated, naive) with `datetime.now(timezone.utc)` throughout to avoid silent comparison bugs against `TIMESTAMPTZ` columns.
2. **Auto-resolve**: If the condition is no longer met but the alert is still in `triggered` state, I added logic to transition it back to `active` automatically — preventing stuck alerts when traffic drops.
3. **Retry safety**: Added `bind=True, max_retries=3, default_retry_delay=30` so transient DB connection failures don't silently swallow an entire evaluation cycle.
4. **Observability**: Added `structlog` instrumentation so every evaluation produces a structured log line with `alert_id`, `metric`, `current_value`, `threshold`, and `triggered` outcome.

---

## 6. Testing Strategy

I asked: *"How do I write async pytest tests for a FastAPI app that uses PostgreSQL without needing a live database connection?"*

The suggestion: override the `get_db` FastAPI dependency with a SQLite in-memory database using `aiosqlite` — fully isolated, no Docker required, runs in CI.

**My implementation**: `app.dependency_overrides[get_db] = override_get_db` in `conftest.py`. The test database is created fresh at session start and dropped at the end. I wrote tests covering:
- **Auth**: register, duplicate email rejection, login, wrong password, `/me`, token refresh
- **Events**: single ingestion, batch ingestion, oversized batch rejection (>500 events), webhook receiver, CSV upload, unauthenticated rejection
- **Alerts**: create with full schema, resolve, mute with duration, webhook URL field, report scheduling

---

## Conclusion

I used LLM assistance as a **pair-programmer** — it helped me move fast on boilerplate and gave me a second opinion on library choices, but every output went through validation:
- Async patterns (`AsyncSession`, timezone-aware datetimes, `asyncio.run()` in Celery tasks)
- Security implications (cookie flags, key hashing, rotation atomicity)
- Edge cases I explicitly added (auto-unmute, auto-resolve, exponential backoff, thundering herd prevention)
- Production concerns (Celery retry/backoff, per-org WebSocket isolation, asymmetric rate limits)

The AI accelerated implementation. The engineering decisions — and their correctness — were mine.
