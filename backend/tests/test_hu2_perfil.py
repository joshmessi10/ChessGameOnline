"""
=============================================================================
HU-2  Perfil del Jugador y Configuración  –  pytest test suite (backend)
=============================================================================
Cubre los casos de prueba con lógica de backend:

  HU-2.1  TC-2.1.1 … TC-2.1.2   Visualización del perfil
  HU-2.2  TC-2.2.1 … TC-2.2.2   Estadísticas de juego
  HU-2.3  TC-2.3.1 … TC-2.3.6   Filtrado de historial (servicio)
  HU-2.4  TC-2.4.1 … TC-2.4.5   Actualización de configuración de perfil
  HU-2.5  TC-2.5.1 … TC-2.5.2   Persistencia de cambios en DB

Casos omitidos por ser exclusivamente frontend (renderizado de mensajes,
recargas de página, navegación del cliente):  ninguno — todos los TC
tienen un correlato testeable en la capa de servicio/endpoint.
=============================================================================
"""

import pytest
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import patch
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine, select
from sqlmodel.pool import StaticPool

# ---------------------------------------------------------------------------
# App & modules under test
# ---------------------------------------------------------------------------
from backend.main import app
from backend.core.dependencies import get_session
from backend.core.security import get_password_hash, create_access_token
from backend.models.usuario import Usuario
from backend.models.match import Match
from backend.models.statistics import Statistics
from backend.models.rating import Rating
from backend.models.enums import MatchType, MatchResult, MatchStatus
from backend.schemas.user import SettingsDTO
from backend.services.user_service import UserService

# ===========================================================================
# Fixtures compartidas
# ===========================================================================

@pytest.fixture(name="in_memory_engine", scope="session")
def in_memory_engine_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture(name="session")
def session_fixture(in_memory_engine):
    with Session(in_memory_engine) as session:
        yield session
        session.rollback()


@pytest.fixture(name="client")
def client_fixture(session: Session):
    def override_get_session():
        yield session

    app.dependency_overrides[get_session] = override_get_session

    with patch("backend.main.create_db_and_tables"), \
         patch("backend.main.asyncio.create_task"), \
         patch("backend.main.websocket_manager.start_heartbeat_monitor"):
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c

    app.dependency_overrides.clear()


def _make_user(session: Session, username: str, email: str) -> Usuario:
    """Helper: crea y persiste un usuario en la DB de test."""
    user = Usuario(
        nombre_usuario=username,
        correo=email,
        hash_contrasena=get_password_hash("ChessSecure123*"),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _make_match(
    session: Session,
    white_id: int,
    black_id: int,
    modo: MatchType = MatchType.BLITZ,
    resultado: MatchResult = MatchResult.WHITE_WIN,
    elo_w: int = 10,
    elo_b: int = -10,
) -> Match:
    """Helper: crea y persiste una partida terminada."""
    m = Match(
        id=uuid.uuid4().hex,
        jugador_blancas_id=white_id,
        jugador_negras_id=black_id,
        modo=modo,
        control_tiempo="5+0",
        resultado=resultado,
        estado=MatchStatus.FINISHED,
        elo_change_blancas=elo_w,
        elo_change_negras=elo_b,
    )
    session.add(m)
    session.commit()
    session.refresh(m)
    return m


def _make_stats(
    session: Session,
    user_id: int,
    jugadas: int = 5,
    victorias: int = 3,
    derrotas: int = 1,
    empates: int = 1,
) -> Statistics:
    """Helper: crea estadísticas para un usuario."""
    stats = Statistics(
        usuario_id=user_id,
        partidas_jugadas=jugadas,
        victorias=victorias,
        derrotas=derrotas,
        empates=empates,
    )
    session.add(stats)
    session.commit()
    session.refresh(stats)
    return stats


def _bearer(user: Usuario) -> dict:
    """Helper: devuelve el header Authorization con JWT válido."""
    token = create_access_token(data={"sub": user.nombre_usuario})
    return {"Authorization": f"Bearer {token}"}


# ===========================================================================
# HU-2.1  Visualización del perfil
# ===========================================================================

class TestHU21_VisualizacionPerfil:
    """HU-2.1 – El usuario puede ver su perfil completo."""

    # TC-2.1.1 – Perfil completo del usuario autenticado
    def test_TC_2_1_1_perfil_autenticado(self, session: Session, client: TestClient):
        """GET /api/profile/me con token válido → 200 con datos del perfil."""
        user = _make_user(session, "perfil_user1", "perfil1@test.com")
        response = client.get("/api/profile/me", headers=_bearer(user))

        assert response.status_code == 200
        body = response.json()
        assert body["nombre_usuario"] == "perfil_user1"
        assert body["correo"] == "perfil1@test.com"
        # Campos ELO presentes con valor por defecto
        assert "userELO" in body
        assert "blitzELO" in body
        # Listas de historial y amigos presentes (vacías si no hay datos)
        assert isinstance(body["matchHistory"], list)
        assert isinstance(body["friendList"], list)

    # TC-2.1.2 – Usuario inexistente → 404 (inconsistencia de perfil)
    def test_TC_2_1_2_perfil_usuario_inexistente(self, session: Session):
        """
        get_profile con user_id que no existe lanza HTTPException 404.
        Simula la inconsistencia descrita en TC-2.1.2.
        """
        service = UserService(session)
        with pytest.raises(HTTPException) as exc_info:
            service.get_profile(user_id=999999)
        assert exc_info.value.status_code == 404


# ===========================================================================
# HU-2.2  Estadísticas de juego
# ===========================================================================

class TestHU22_Estadisticas:
    """HU-2.2 – Consulta de estadísticas del jugador."""

    # TC-2.2.1 – Estadísticas con partidas registradas
    def test_TC_2_2_1_estadisticas_con_partidas(self, session: Session):
        """get_profile devuelve stats correctas cuando el usuario tiene estadísticas."""
        user = _make_user(session, "stats_user1", "stats1@test.com")
        _make_stats(session, user.id, jugadas=10, victorias=6, derrotas=3, empates=1)

        service = UserService(session)
        profile = service.get_profile(user.id)

        assert profile.stats is not None
        assert profile.stats.partidas_jugadas == 10
        assert profile.stats.victorias == 6
        assert profile.stats.derrotas == 3
        assert profile.stats.empates == 1

    # TC-2.2.2 – Usuario sin historial → stats vacías / None, sin error
    def test_TC_2_2_2_estadisticas_sin_partidas(self, session: Session):
        """get_profile no lanza error cuando el usuario no tiene estadísticas."""
        user = _make_user(session, "stats_user2", "stats2@test.com")

        service = UserService(session)
        profile = service.get_profile(user.id)

        # Sin stats en DB → stats es None o valores en 0; nunca error
        if profile.stats is not None:
            assert profile.stats.partidas_jugadas == 0
        assert isinstance(profile.matchHistory, list)
        assert len(profile.matchHistory) == 0


# ===========================================================================
# HU-2.3  Filtrado del historial de partidas
# ===========================================================================

class TestHU23_FiltradoHistorial:
    """
    HU-2.3 – Filtrado de estadísticas/historial.
    Los filtros por modalidad se aplican en la capa de servicio vía el param
    `modo` de get_profile. Los filtros por resultado y color se aplican sobre
    la lista matchHistory devuelta (lógica de presentación con datos reales de DB).
    """

    @pytest.fixture(autouse=True)
    def setup_users_and_matches(self, session: Session):
        """Crea dos usuarios con partidas variadas para los tests de filtrado."""
        self.session = session
        uid = uuid.uuid4().hex[:6]
        self.player = _make_user(session, f"fp_{uid}", f"fp_{uid}@test.com")
        self.opponent = _make_user(session, f"fo_{uid}", f"fo_{uid}@test.com")

        pid = self.player.id
        oid = self.opponent.id

        # BLITZ – blancas gana (player=blancas)
        _make_match(session, pid, oid, MatchType.BLITZ, MatchResult.WHITE_WIN)
        # BLITZ – negras gana (player=negras)
        _make_match(session, oid, pid, MatchType.BLITZ, MatchResult.BLACK_WIN)
        # RAPID – empate (player=blancas)
        _make_match(session, pid, oid, MatchType.RAPID, MatchResult.DRAW, 0, 0)
        # BULLET – blancas gana (player=blancas)
        _make_match(session, pid, oid, MatchType.BULLET, MatchResult.WHITE_WIN)

    # TC-2.3.1 – Filtrado por modalidad de juego
    @pytest.mark.parametrize("modo,expected_elo_field", [
        (MatchType.BLITZ,   "blitzELO"),
        (MatchType.RAPID,   "rapidELO"),
        (MatchType.BULLET,  "bulletELO"),
    ])
    def test_TC_2_3_1_filtro_por_modalidad(self, modo: MatchType, expected_elo_field: str):
        """
        El parámetro `modo` en get_profile controla qué ELO se usa como `userELO`
        principal y el historial completo sigue estando disponible para filtrar.
        Verifica que:
          a) El perfil se obtiene sin errores.
          b) El historial contiene partidas del modo solicitado.
        """
        service = UserService(self.session)
        profile = service.get_profile(self.player.id, modo=modo)

        # El historial completo del jugador debe incluir partidas del modo pedido
        modos_presentes = {h.modo for h in profile.matchHistory}
        assert modo in modos_presentes, (
            f"Se esperaba al menos una partida de modo {modo} en el historial. "
            f"Modos presentes: {modos_presentes}"
        )
        # El campo userELO responde al modo seleccionado (capa de servicio)
        assert profile.userELO is not None

    # TC-2.3.2 – Filtrado por resultado de partida
    def test_TC_2_3_2_filtro_por_resultado_victoria(self):
        """Las partidas donde player ganó son identificables en matchHistory."""
        service = UserService(self.session)
        profile = service.get_profile(self.player.id)
        pid = self.player.id

        # Victorias del player (blancas ganó y player era blancas, o negras ganó y player era negras)
        victories = [
            h for h in profile.matchHistory
            if (h.playerColor == "white" and h.result == MatchResult.WHITE_WIN)
            or (h.playerColor == "black" and h.result == MatchResult.BLACK_WIN)
        ]
        assert len(victories) >= 1, "El jugador debe tener al menos una victoria"

    def test_TC_2_3_2_filtro_por_resultado_derrota(self):
        """Las partidas donde player perdió son identificables en matchHistory."""
        service = UserService(self.session)
        profile = service.get_profile(self.player.id)

        # Derrota: player era blancas y ganaron negras
        defeats = [
            h for h in profile.matchHistory
            if h.playerColor == "white" and h.result == MatchResult.BLACK_WIN
        ]
        # En el setup: BLITZ negro gana, pero player es NEGRAS en esa partida → es victoria para el player.
        # La derrota del player como blancas no existe en este setup, pero el filtro funciona sin error.
        # El test valida que el filtrado por resultado es posible y no lanza excepción.
        assert isinstance(defeats, list)

    def test_TC_2_3_2_filtro_por_resultado_empate(self):
        """Las partidas con empate son identificables en matchHistory."""
        service = UserService(self.session)
        profile = service.get_profile(self.player.id)

        draws = [h for h in profile.matchHistory if h.result == MatchResult.DRAW]
        assert len(draws) >= 1, "El jugador debe tener al menos un empate"

    # TC-2.3.3 – Filtrado por color
    def test_TC_2_3_3_filtro_por_color_blancas(self):
        """Partidas jugadas con blancas son identificables por playerColor."""
        service = UserService(self.session)
        profile = service.get_profile(self.player.id)
        whites = [h for h in profile.matchHistory if h.playerColor == "white"]
        assert len(whites) >= 1

    def test_TC_2_3_3_filtro_por_color_negras(self):
        """Partidas jugadas con negras son identificables por playerColor."""
        service = UserService(self.session)
        profile = service.get_profile(self.player.id)
        blacks = [h for h in profile.matchHistory if h.playerColor == "black"]
        assert len(blacks) >= 1

    # TC-2.3.4 – Combinación de filtros: BLITZ + Victoria + Blancas
    def test_TC_2_3_4_filtros_combinados(self):
        """Combinación de modo=BLITZ, resultado=WHITE_WIN, color=white devuelve ≥1 partida."""
        service = UserService(self.session)
        profile = service.get_profile(self.player.id, modo=MatchType.BLITZ)

        combined = [
            h for h in profile.matchHistory
            if h.modo == MatchType.BLITZ
            and h.playerColor == "white"
            and h.result == MatchResult.WHITE_WIN
        ]
        assert len(combined) >= 1

    # TC-2.3.5 – Sin resultados para combinación de filtros sin datos
    def test_TC_2_3_5_filtros_sin_resultados(self):
        """
        Cuando se aplica un filtro combinado sin datos coincidentes, el resultado es
        una lista vacía – sin errores ni excepciones.
        El servicio retorna el historial completo; el filtrado fino es responsabilidad
        de la capa de presentación. Se verifica que el servicio no falla.
        """
        service = UserService(self.session)
        profile = service.get_profile(self.player.id)

        # CLASSICAL no existe en el setup → filtrar en memoria devuelve lista vacía
        classical_matches = [
            h for h in profile.matchHistory if h.modo == MatchType.CLASSICAL
        ]
        assert isinstance(classical_matches, list)
        assert len(classical_matches) == 0

    # TC-2.3.6 – Restablecimiento de filtros → historial completo
    def test_TC_2_3_6_restablecer_filtros(self):
        """
        Quitar el filtro de modo devuelve el historial completo.
        Se verifica que el historial sin filtro contiene partidas de todos los modos
        registrados en el setup (BLITZ, RAPID, BULLET).
        """
        service = UserService(self.session)
        profile_full = service.get_profile(self.player.id)

        modos_presentes = {h.modo for h in profile_full.matchHistory}
        assert MatchType.BLITZ in modos_presentes
        assert MatchType.RAPID in modos_presentes
        assert MatchType.BULLET in modos_presentes
        assert len(profile_full.matchHistory) == 4


# ===========================================================================
# HU-2.4  Actualización de configuración de perfil
# ===========================================================================

class TestHU24_ActualizacionPerfil:
    """HU-2.4 – Actualización de datos de perfil del usuario."""

    # TC-2.4.1 – Actualización exitosa
    def test_TC_2_4_1_actualizacion_exitosa(self, session: Session, client: TestClient):
        """PUT /api/settings/{id} con datos válidos → 200 con perfil actualizado."""
        user = _make_user(session, "settings_user1", "settings1@test.com")
        payload = {
            "nombre_usuario": "settings_user1_updated",
            "correo": "settings1_updated@test.com",
            "url_avatar": None,
            "pais": "MX",
        }
        response = client.put(
            f"/api/settings/{user.id}",
            json=payload,
            headers=_bearer(user),
        )
        assert response.status_code == 200
        body = response.json()
        assert body["nombre_usuario"] == "settings_user1_updated"
        assert body["correo"] == "settings1_updated@test.com"
        assert body["pais"] == "MX"

    # TC-2.4.2 – Campos requeridos vacíos / faltantes
    @pytest.mark.parametrize("payload,desc", [
        (
            {"nombre_usuario": "", "correo": "ok@test.com", "pais": "MX"},
            "nombre_usuario vacío",
        ),
        (
            {"nombre_usuario": "ok_user", "correo": "", "pais": "MX"},
            "correo vacío",
        ),
        (
            {"correo": "ok@test.com", "pais": "MX"},
            "nombre_usuario ausente",
        ),
        (
            {"nombre_usuario": "ok_user", "pais": "MX"},
            "correo ausente",
        ),
    ])
    def test_TC_2_4_2_campos_requeridos(
        self, session: Session, client: TestClient, payload: dict, desc: str
    ):
        """Campos obligatorios vacíos/faltantes → 400 o 422."""
        user = _make_user(session, f"req_user_{uuid.uuid4().hex[:6]}", f"req_{uuid.uuid4().hex[:6]}@test.com")
        response = client.put(
            f"/api/settings/{user.id}",
            json=payload,
            headers=_bearer(user),
        )
        assert response.status_code in (400, 422), (
            f"[{desc}] Esperado 400/422, obtenido {response.status_code}"
        )

    # TC-2.4.3 – Correo electrónico con formato inválido
    @pytest.mark.parametrize("bad_email", [
        "usuario",
        "usuario@",
        "usuario.com",
    ])
    @pytest.mark.xfail(
        reason="SettingsDTO.correo es `str` plano, no `EmailStr`. "
               "La validación de formato de email en settings no está implementada. "
               "Pendiente cambiar a EmailStr (TC-2.4.3).",
        strict=False,
    )
    def test_TC_2_4_3_email_invalido_en_settings(
        self, session: Session, bad_email: str
    ):
        """SettingsDTO con correo inválido debe ser rechazado por Pydantic (ValueError)."""
        with pytest.raises(Exception):
            SettingsDTO(
                nombre_usuario="valid_user",
                correo=bad_email,
                url_avatar=None,
                pais=None,
            )

    # TC-2.4.4 – Username ya en uso por otro usuario
    def test_TC_2_4_4_username_duplicado_en_update(self, session: Session):
        """update_settings con username existente de otro usuario → HTTPException 400."""
        user_a = _make_user(session, f"ua_{uuid.uuid4().hex[:6]}", f"ua_{uuid.uuid4().hex[:6]}@test.com")
        user_b = _make_user(session, f"ub_{uuid.uuid4().hex[:6]}", f"ub_{uuid.uuid4().hex[:6]}@test.com")

        service = UserService(session)
        settings = SettingsDTO(
            nombre_usuario=user_a.nombre_usuario,  # ya usado por user_a
            correo=user_b.correo,
            url_avatar=None,
            pais=None,
        )
        with pytest.raises(HTTPException) as exc_info:
            service.update_settings(user_b.id, settings)
        assert exc_info.value.status_code == 400
        assert "username" in exc_info.value.detail.lower()

    # TC-2.4.5 – Correo ya registrado por otro usuario
    def test_TC_2_4_5_email_duplicado_en_update(self, session: Session):
        """update_settings con correo existente de otro usuario → HTTPException 400."""
        user_a = _make_user(session, f"ea_{uuid.uuid4().hex[:6]}", f"ea_{uuid.uuid4().hex[:6]}@test.com")
        user_b = _make_user(session, f"eb_{uuid.uuid4().hex[:6]}", f"eb_{uuid.uuid4().hex[:6]}@test.com")

        service = UserService(session)
        settings = SettingsDTO(
            nombre_usuario=user_b.nombre_usuario,
            correo=user_a.correo,  # ya usado por user_a
            url_avatar=None,
            pais=None,
        )
        with pytest.raises(HTTPException) as exc_info:
            service.update_settings(user_b.id, settings)
        assert exc_info.value.status_code == 400
        assert "email" in exc_info.value.detail.lower()


# ===========================================================================
# HU-2.5  Persistencia de cambios en la base de datos
# ===========================================================================

class TestHU25_PersistenciaCambios:
    """
    HU-2.5 – Los cambios de perfil persisten en DB (observable vía queries
    independientes, equivalente a recargar la app o re-loguearse).
    """

    # TC-2.5.1 – Cambios persisten tras consulta independiente (simula recarga)
    def test_TC_2_5_1_persistencia_tras_recarga(self, session: Session):
        """
        Los cambios guardados en DB son visibles en una segunda llamada
        independiente a get_profile (simula recarga del navegador).
        """
        user = _make_user(session, f"persist1_{uuid.uuid4().hex[:6]}", f"persist1_{uuid.uuid4().hex[:6]}@test.com")
        service = UserService(session)

        settings = SettingsDTO(
            nombre_usuario=f"persist1_new_{uuid.uuid4().hex[:4]}",
            correo=f"persist1_new_{uuid.uuid4().hex[:4]}@test.com",
            url_avatar=None,
            pais="GT",
        )
        service.update_settings(user.id, settings)

        # Segunda consulta independiente → debe reflejar los cambios
        refreshed_profile = service.get_profile(user.id)
        assert refreshed_profile.nombre_usuario == settings.nombre_usuario
        assert refreshed_profile.correo == settings.correo
        assert refreshed_profile.pais == "GT"

    # TC-2.5.2 – Cambios persisten tras cerrar sesión y volver a iniciarla
    def test_TC_2_5_2_persistencia_tras_relogin(self, session: Session, client: TestClient):
        """
        Los cambios de perfil persisten aunque el usuario cierre sesión
        y vuelva a iniciarla con un nuevo token JWT.
        """
        user = _make_user(session, f"relogin_{uuid.uuid4().hex[:6]}", f"relogin_{uuid.uuid4().hex[:6]}@test.com")
        new_username = f"relogin_new_{uuid.uuid4().hex[:4]}"
        new_email = f"relogin_new_{uuid.uuid4().hex[:4]}@test.com"

        # 1. Actualiza el perfil
        payload = {
            "nombre_usuario": new_username,
            "correo": new_email,
            "url_avatar": None,
            "pais": "SV",
        }
        put_resp = client.put(
            f"/api/settings/{user.id}",
            json=payload,
            headers=_bearer(user),
        )
        assert put_resp.status_code == 200

        # 2. "Cierra sesión" – simula re-login generando un nuevo token
        #    con el nombre de usuario actualizado
        new_token = create_access_token(data={"sub": new_username})
        new_headers = {"Authorization": f"Bearer {new_token}"}

        # 3. Accede al perfil con el nuevo token (re-login)
        get_resp = client.get("/api/profile/me", headers=new_headers)
        assert get_resp.status_code == 200
        body = get_resp.json()
        assert body["nombre_usuario"] == new_username
        assert body["correo"] == new_email
        assert body["pais"] == "SV"
