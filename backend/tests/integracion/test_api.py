import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session
from backend.models.usuario import Usuario

def test_api_register(client: TestClient):
    payload = {
        "nombre_usuario": "apiuser",
        "correo": "api@test.com",
        "hash_contrasena": "pass123"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    assert response.json()["nombre_usuario"] == "apiuser"

def test_api_login(client: TestClient, db: Session, make_user):
    user = make_user(db, username="loginapi", email="loginapi@test.com")
    payload = {
        "username": "loginapi",
        "password": "ChessSecure123*"
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_api_get_profile_me(client: TestClient, db: Session, make_user, bearer):
    user = make_user(db, username="meprofile")
    headers = bearer(user)
    response = client.get("/api/profile/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["nombre_usuario"] == "meprofile"

def test_api_get_profile_me_unauthorized(client: TestClient):
    response = client.get("/api/profile/me")
    assert response.status_code == 401

def test_api_update_settings(client: TestClient, db: Session, make_user, bearer):
    user = make_user(db, username="settingsapi")
    headers = bearer(user)
    payload = {
        "nombre_usuario": "settingsapi_new",
        "correo": "settingsapi_new@test.com",
        "url_avatar": None,
        "pais": "AR"
    }
    response = client.put(f"/api/settings/{user.id}", json=payload, headers=headers)
    assert response.status_code == 200
    assert response.json()["nombre_usuario"] == "settingsapi_new"
