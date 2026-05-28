# LLM Validation & Reasoning

As requested by the assignment parameters, this document outlines how LLM assistance was used during the design, architecture, and implementation phases of this project — including the validation steps and engineering judgments applied to LLM-generated output.

---

## 1. Architectural Reasoning & Trade-off Analysis

**Prompt style used**: "Given these constraints [X], compare [A] vs [B] on dimensions of operational complexity, query performance at scale, and development velocity."

### Database & Infrastructure Stack

- **Initial Idea explored**: Kafka + MongoDB + Pinecone (separate vector store).
- **LLM-assisted trade-off analysis**: Kafka adds broker management, consumer group coordination, and partition tuning overhead. Pinecone is a managed external service that introduces latency, cost, and a network dependency for every search query. MongoDB's schema flexibility adds value only when your data shape is genuinely unknown at design time — here, event schemas are well-defined via Pydantic.
- **Engineering decision**: Consolidated to **PostgreSQL + pgvector + Redis**. PostgreSQL handles relational data (users, orgs, alerts), JSONB payloads (event metadata, widget configs), and vector similarity search in a single service. Redis handles Celery task brokering, task result storage, and rate limit counters. This reduces the infrastructure surface from 4 services to 2 without sacrificing any capability needed at this scale.

### Task Queue Design

- **Explored**: FastAPI `BackgroundTasks` (built-in) vs Celery + Redis.
- **Validation**: FastAPI `BackgroundTasks` run in the same process as the web server. If the task is CPU-bound (like generating sentence-transformer embeddings) or long-running (like report generation), it blocks the event loop and degrades API throughput. LLM reasoning confirmed this; the decision to use Celery with a dedicated worker process was made explicitly to isolate heavy computation from request handling.
- **Celery Beat** was chosen over a cron job on the host OS because it is process-aware (tasks are only dispatched if a worker is alive), retryable with backoff, and co-deployable as a Railway service alongside the worker.

---

## 2. Schema & Model Design Decisions

**Prompt style used**: "What columns should a production alert rule model have to support [feature list]? What are the edge cases?"

### Alert Model
- LLM suggested adding `condition` (operator: `>`, `<`, `>=`, `<=`, `==`), `window_minutes` (time-boxed evaluation), `notification_channel`, `webhook_url`, `muted_until`, `triggered_at`, and `triggered_value`.
- **Validation applied**: Verified that `muted_until` as a `TIMESTAMPTZ` column is the correct approach (rather than a boolean `is_muted`) because it allows automatic unmuting by comparing with `now()` without needing a separate scheduled task to flip the flag.
- **Engineering decision**: Added auto-unmute logic inside the Celery `evaluate_alerts` task — if `muted_until < now`, the alert is automatically set back to `active` before evaluation, eliminating the need for a separate "unmute" worker.

### pgvector Embedding Strategy
- **Prompt**: "How should we avoid reloading the sentence-transformer model on every request in a FastAPI async application?"
- **LLM suggestion**: Load at module import time as a global singleton.
- **Validation**: Confirmed this is safe in a single-worker deployment (Railway runs one Uvicorn process). For multi-worker deployments, the model would be loaded once per worker process — acceptable memory overhead at the scale of this project (~90MB per process for `all-MiniLM-L6-v2`).
- **Explicit decision**: Used `sentence-transformers` locally instead of calling OpenAI Embeddings API to eliminate external API dependency, latency, and cost for a demo system.

---

## 3. Security Decisions

**Prompt style used**: "What are the security implications of [implementation X]? What should I validate?"

### JWT + Refresh Token Design
- LLM suggested using short-lived access tokens (30 minutes) with a long-lived refresh token stored in an **HTTP-only, Secure, SameSite=Lax** cookie.
- **Validation**: Confirmed the cookie flags are correct — `HttpOnly` prevents JavaScript access (XSS protection), `Secure` ensures it only transmits over HTTPS, `SameSite=Lax` prevents CSRF while allowing top-level navigation.
- **Explicit decision**: The refresh token is **not stored in the database** in this implementation (stateless). A production upgrade path would be a `refresh_token_blacklist` Redis set to support explicit revocation on logout.

### API Key Hashing
- **LLM suggestion**: Store a SHA-256 hash of the API key, never the key itself. Return the raw key exactly once on creation.
- **Validation**: Applied — `key_hash = hashlib.sha256(raw_key.encode()).hexdigest()`. The `prefix` field (first 8 chars) is stored plaintext to allow users to identify keys in the UI without exposing the secret.
- **Rotation implementation**: On rotate, the old key is marked `is_active = False` in the same DB transaction before the new key is committed, ensuring there is no window where both keys are simultaneously active.

### Rate Limiting
- **Prompt**: "What's the idiomatic way to add per-IP rate limiting in FastAPI?"
- **LLM answer**: `slowapi` (a Starlette-compatible port of Flask-Limiter) with a Redis backend for distributed rate limit state.
- **Validation**: Applied `@limiter.limit("100/minute")` on ingestion endpoints. Limits are intentionally asymmetric: stricter on bulk operations (20/min batch, 10/min CSV) to prevent abuse, looser on single-event ingestion (100/min) to support high-frequency SDKs.

---

## 4. Real-Time Architecture

**Prompt**: "What's the right approach for real-time event streaming in FastAPI — SSE or WebSocket?"

- **LLM trade-off**: SSE is simpler (one-directional, works over plain HTTP/2, no special proxy config), but WebSocket is required if the server needs to receive messages from the client (e.g., subscribing to specific org channels by sending the org ID after connect).
- **Decision**: WebSocket was chosen because the org-level isolation model requires the client to authenticate and identify its org during the handshake. The `ConnectionManager` maintains a `Dict[int, List[WebSocket]]` — one list of sockets per `org_id` — to ensure events are only broadcast to members of the correct organization.

### WebSocket Reconnection (Frontend)
- **LLM suggestion**: Simple 3-second fixed retry on `onclose`.
- **Validation & improvement**: A fixed retry creates a thundering herd if the backend restarts — all clients reconnect simultaneously. Applied **exponential backoff** instead: starts at 1s, doubles on each failure, caps at 30s. Delay resets to 1s on successful reconnect.

---

## 5. Celery Alert Evaluation Logic

**Prompt**: "Write a Celery task that evaluates alert rules against a time-series event table."

- **LLM output**: Queried `COUNT(*)` of events matching `event_type = alert.metric` within `now() - window_minutes`.
- **Validation applied**:
  1. Verified timezone awareness — `datetime.now(timezone.utc)` used throughout to avoid naive datetime comparison bugs with `TIMESTAMPTZ` columns.
  2. Added auto-resolve: if the condition is no longer met but the alert is in `triggered` state, it transitions back to `active` automatically — this prevents stuck `triggered` alerts when traffic drops.
  3. The task uses `bind=True, max_retries=3, default_retry_delay=30` so transient DB connection failures don't silently drop evaluations.
  4. Added structlog instrumentation inside the task so every evaluation cycle produces a structured log line with `alert_id`, `metric`, `current_value`, `threshold`, and `triggered` flag.

---

## 6. Testing Strategy

**Prompt**: "How do I write async pytest tests for a FastAPI app that uses PostgreSQL without hitting a real database?"

- **LLM suggestion**: Override the `get_db` dependency with a SQLite in-memory database using `aiosqlite` for test isolation.
- **Validation**: Applied via `app.dependency_overrides[get_db] = override_get_db` in `conftest.py`. The test DB is created fresh at session start and dropped at the end, making tests fully hermetic and runnable in CI without a PostgreSQL instance.
- **Test coverage applied**:
  - Auth: register, duplicate email rejection, login, wrong password, `/me`, token refresh
  - Events: single ingestion, batch ingestion, oversized batch rejection (>500), webhook receiver, CSV upload, list events, unauthenticated rejection
  - Alerts: create with full schema, list, resolve, mute, webhook URL persistence, report with schedule

---

## Conclusion

LLM assistance was used as a **senior pair-programmer** — it generated idiomatic implementations quickly, but every output was audited for:
- Correctness of async patterns (`AsyncSession`, `await`, `asyncio.run()` in Celery tasks)
- Security implications (cookie flags, key hashing, SQL injection via ORM)
- Edge cases (timezone-aware datetimes, auto-unmute, thundering-herd reconnect)
- Production readiness (retry/backoff on Celery tasks, per-org WebSocket isolation)

All architectural constraints, technology selections, and security paradigms were driven by explicit engineering judgment. The LLM accelerated implementation; the engineering decisions determined correctness.
