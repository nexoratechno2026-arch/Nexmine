"""
Phase 1 smoke tests — auth endpoints.
Run from E:/Nexmine/backend with:
    pytest tests/ -v
Requires: a running Postgres (docker-compose up -d)
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

import uuid
TEST_EMAIL = f"smoketest_{uuid.uuid4().hex[:8]}@example.com"
TEST_PASSWORD = "TestPass123!"
TEST_NAME = "Smoke Test"

# ─── Health ──────────────────────────────────────────────────────────────────

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

# ─── Register ─────────────────────────────────────────────────────────────────

def test_register_success():
    r = client.post("/auth/register", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "full_name": TEST_NAME,
    })
    assert r.status_code == 201, r.text
    data = r.json()
    assert "access_token" in data
    assert data["email"] == TEST_EMAIL

def test_register_duplicate():
    client.post("/auth/register", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    r = client.post("/auth/register", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    assert r.status_code == 409

# ─── Login ────────────────────────────────────────────────────────────────────

def test_login_success():
    client.post("/auth/register", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    r = client.post("/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    assert r.status_code == 200
    assert "access_token" in r.json()

def test_login_wrong_password():
    r = client.post("/auth/login", json={"email": TEST_EMAIL, "password": "wrong"})
    assert r.status_code == 401

# ─── /auth/me ────────────────────────────────────────────────────────────────

def test_me_with_valid_token():
    client.post("/auth/register", json={"email": TEST_EMAIL, "password": TEST_PASSWORD, "full_name": TEST_NAME})
    login = client.post("/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    token = login.json()["access_token"]
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == TEST_EMAIL

def test_me_with_bad_token():
    r = client.get("/auth/me", headers={"Authorization": "Bearer bogustoken"})
    assert r.status_code == 401
