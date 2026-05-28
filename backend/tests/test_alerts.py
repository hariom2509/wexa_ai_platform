"""
Tests for Alerts — create, list, resolve, mute, trigger.
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_create_alert(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/alerts/", json={
        "name": "High Error Rate",
        "metric": "error",
        "condition": ">",
        "threshold": 10.0,
        "window_minutes": 5,
        "notification_channel": "in-app"
    }, headers=auth_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "High Error Rate"
    assert body["status"] == "active"
    assert body["condition"] == ">"
    return body["id"]


async def test_list_alerts(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/alerts/", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_resolve_alert(client: AsyncClient, auth_headers: dict):
    # Create an alert first
    create_resp = await client.post("/api/alerts/", json={
        "name": "To Resolve",
        "metric": "cpu",
        "condition": ">",
        "threshold": 90.0,
        "window_minutes": 1,
        "notification_channel": "in-app"
    }, headers=auth_headers)
    alert_id = create_resp.json()["id"]

    # Resolve it
    resp = await client.put(f"/api/alerts/{alert_id}/resolve", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "resolved"


async def test_mute_alert(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/alerts/", json={
        "name": "To Mute",
        "metric": "warning",
        "condition": ">",
        "threshold": 5.0,
        "window_minutes": 1,
        "notification_channel": "in-app"
    }, headers=auth_headers)
    alert_id = create_resp.json()["id"]

    resp = await client.put(f"/api/alerts/{alert_id}/mute", json={"minutes": 30}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "muted"
    assert body["muted_until"] is not None


async def test_alert_with_webhook_url(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/alerts/", json={
        "name": "Slack Alert",
        "metric": "payment_failed",
        "condition": ">",
        "threshold": 1.0,
        "window_minutes": 10,
        "notification_channel": "webhook",
        "webhook_url": "https://hooks.slack.com/services/fake/webhook"
    }, headers=auth_headers)
    assert resp.status_code == 201
    assert resp.json()["webhook_url"] == "https://hooks.slack.com/services/fake/webhook"


async def test_report_create_with_schedule(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/reports/", json={
        "name": "Weekly Sales Report",
        "schedule": "weekly"
    }, headers=auth_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["schedule"] == "weekly"
    assert body["next_run_at"] is not None
