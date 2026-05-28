"""
Tests for Authentication & Multi-Tenancy flows.
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_register_creates_user_and_org(client: AsyncClient):
    resp = await client.post("/api/auth/register", json={
        "email": "new@example.com",
        "password": "Password123!",
        "organization_name": "New Org"
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "new@example.com"
    assert body["role"] == "owner"
    assert "organization_id" in body


async def test_register_duplicate_email_fails(client: AsyncClient):
    payload = {"email": "dup@example.com", "password": "pw", "organization_name": "Org"}
    await client.post("/api/auth/register", json=payload)
    resp = await client.post("/api/auth/register", json=payload)
    assert resp.status_code == 400
    assert "already registered" in resp.json()["detail"]


async def test_login_returns_token(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "login@example.com",
        "password": "Password123!",
        "organization_name": "Login Org"
    })
    resp = await client.post("/api/auth/login", json={
        "email": "login@example.com",
        "password": "Password123!"
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()
    assert resp.json()["token_type"] == "bearer"
    # Refresh token should be set as HTTP-only cookie
    assert "refresh_token" in resp.cookies


async def test_login_wrong_password_fails(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "wrongpw@example.com",
        "password": "CorrectPassword!",
        "organization_name": "WP Org"
    })
    resp = await client.post("/api/auth/login", json={
        "email": "wrongpw@example.com",
        "password": "WrongPassword!"
    })
    assert resp.status_code == 400


async def test_get_me(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "email" in body
    assert "role" in body


async def test_refresh_token(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "refresh@example.com",
        "password": "Password123!",
        "organization_name": "Refresh Org"
    })
    login_resp = await client.post("/api/auth/login", json={
        "email": "refresh@example.com",
        "password": "Password123!"
    })
    # Use the cookie that was set
    refresh_resp = await client.post("/api/auth/refresh")
    assert refresh_resp.status_code == 200
    assert "access_token" in refresh_resp.json()
