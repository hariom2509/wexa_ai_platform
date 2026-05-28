"""
Tests for Event ingestion — single, batch, and CSV upload.
"""
import pytest
import io
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_ingest_single_event(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/events/", json={
        "event_type": "page_view",
        "payload": {"url": "/home", "user_id": "u123"}
    }, headers=auth_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["event_type"] == "page_view"
    assert "id" in body


async def test_ingest_batch_events(client: AsyncClient, auth_headers: dict):
    events = [
        {"event_type": "click", "payload": {"button": "cta"}},
        {"event_type": "purchase", "payload": {"amount": 99.99}},
        {"event_type": "error", "payload": {"code": 500}},
    ]
    resp = await client.post("/api/events/batch", json=events, headers=auth_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["detail"] == "Successfully ingested 3 events"
    assert len(body["event_ids"]) == 3


async def test_batch_too_large_rejected(client: AsyncClient, auth_headers: dict):
    events = [{"event_type": "e", "payload": {}} for _ in range(501)]
    resp = await client.post("/api/events/batch", json=events, headers=auth_headers)
    assert resp.status_code == 400


async def test_webhook_receiver(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/events/webhook", json={
        "event_type": "github_push",
        "ref": "refs/heads/main",
        "repository": "wexa_ai_platform"
    }, headers=auth_headers)
    assert resp.status_code == 201
    assert resp.json()["detail"] == "Webhook event ingested"


async def test_csv_upload(client: AsyncClient, auth_headers: dict):
    csv_content = (
        "event_name,user_id,severity\n"
        "user_login,u1,info\n"
        "user_logout,u2,info\n"
        "payment_failed,u3,error\n"
    )
    files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
    resp = await client.post("/api/events/upload-csv", files=files, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["detail"] == "Successfully ingested 3 events from CSV"


async def test_list_events(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/events/", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_unauthenticated_event_rejected(client: AsyncClient):
    resp = await client.post("/api/events/", json={
        "event_type": "test",
        "payload": {}
    })
    assert resp.status_code == 401
