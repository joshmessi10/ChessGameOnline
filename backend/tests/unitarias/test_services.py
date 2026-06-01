import pytest
from fastapi import HTTPException
from sqlmodel import Session
from backend.services.auth_service import AuthService
from backend.services.user_service import UserService
from backend.schemas.auth import RegisterRequest, LoginRequest
from backend.schemas.user import SettingsDTO
from backend.models.enums import MatchType

def test_auth_service_register_success(db: Session):
    service = AuthService(db)
    req = RegisterRequest(nombre_usuario="newuser", correo="new@test.com", hash_contrasena="pass123")
    user = service.register(req)
    assert user.nombre_usuario == "newuser"
    assert user.correo == "new@test.com"

def test_auth_service_register_duplicate_username(db: Session, make_user):
    make_user(db, username="existuser", email="exist@test.com")
    service = AuthService(db)
    req = RegisterRequest(nombre_usuario="existuser", correo="other@test.com", hash_contrasena="pass123")
    with pytest.raises(HTTPException) as exc:
        service.register(req)
    assert exc.value.status_code == 400

def test_auth_service_login_success(db: Session, make_user):
    user = make_user(db, username="loguser", email="log@test.com")
    service = AuthService(db)
    # Using the raw password since make_user hashes it
    req = LoginRequest(username="loguser", password="ChessSecure123*")
    resp = service.login(req)
    assert resp.access_token is not None

def test_user_service_get_profile(db: Session, make_user, make_stats):
    user = make_user(db, username="profuser")
    make_stats(db, user.id, jugadas=10, victorias=5)
    service = UserService(db)
    profile = service.get_profile(user.id)
    assert profile.nombre_usuario == "profuser"
    assert profile.stats.partidas_jugadas == 10
    assert profile.stats.victorias == 5

def test_user_service_update_settings(db: Session, make_user):
    user = make_user(db, username="setuser", email="set@test.com")
    service = UserService(db)
    settings = SettingsDTO(nombre_usuario="newname", correo="newemail@test.com", url_avatar=None, pais="ES")
    updated = service.update_settings(user.id, settings)
    assert updated.nombre_usuario == "newname"
    assert updated.correo == "newemail@test.com"
    assert updated.pais == "ES"
