"""
conftest.py – Configuración compartida para toda la suite de tests.
Ajusta PYTHONPATH y expone fixtures reutilizables en unitarias/ e integracion/.
"""
import sys, os, uuid
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import pytest
from unittest.mock import patch
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool
from fastapi.testclient import TestClient

from backend.main import app
from backend.core.dependencies import get_session
from backend.core.security import get_password_hash, create_access_token
from backend.models.usuario import Usuario
from backend.models.match import Match
from backend.models.statistics import Statistics
from backend.models.enums import MatchType, MatchResult, MatchStatus


# ---------------------------------------------------------------------------
# Motor SQLite en memoria (una sola instancia por sesión de pytest)
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def engine():
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(eng)
    return eng


@pytest.fixture()
def db(engine):
    """Sesión de DB aislada por test (rollback al final)."""
    with Session(engine) as session:
        yield session
        session.rollback()


# ---------------------------------------------------------------------------
# TestClient con startup mockeado
# ---------------------------------------------------------------------------
@pytest.fixture()
def client(db):
    app.dependency_overrides[get_session] = lambda: (yield db)
    with patch("backend.main.create_db_and_tables"), \
         patch("backend.main.asyncio.create_task"), \
         patch("backend.main.websocket_manager.start_heartbeat_monitor"):
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Helpers de datos
# ---------------------------------------------------------------------------
@pytest.fixture
def make_user():
    def _make_user(db: Session, username: str = None, email: str = None) -> Usuario:
        uid = uuid.uuid4().hex[:8]
        user = Usuario(
            nombre_usuario=username or f"user_{uid}",
            correo=email or f"user_{uid}@test.com",
            hash_contrasena=get_password_hash("ChessSecure123*"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    return _make_user

@pytest.fixture
def make_match():
    def _make_match(
        db: Session,
        white_id: int,
        black_id: int,
        modo: MatchType = MatchType.BLITZ,
        resultado: MatchResult = MatchResult.WHITE_WIN,
    ) -> Match:
        m = Match(
            id=uuid.uuid4().hex,
            jugador_blancas_id=white_id,
            jugador_negras_id=black_id,
            modo=modo,
            control_tiempo="5+0",
            resultado=resultado,
            estado=MatchStatus.FINISHED,
            elo_change_blancas=10,
            elo_change_negras=-10,
        )
        db.add(m)
        db.commit()
        db.refresh(m)
        return m
    return _make_match

@pytest.fixture
def make_stats():
    def _make_stats(db: Session, user_id: int, jugadas=5, victorias=3, derrotas=1, empates=1) -> Statistics:
        s = Statistics(
            usuario_id=user_id,
            partidas_jugadas=jugadas,
            victorias=victorias,
            derrotas=derrotas,
            empates=empates,
        )
        db.add(s)
        db.commit()
        db.refresh(s)
        return s
    return _make_stats

@pytest.fixture
def bearer():
    def _bearer(user: Usuario) -> dict:
        token = create_access_token(data={"sub": user.nombre_usuario})
        return {"Authorization": f"Bearer {token}"}
    return _bearer
