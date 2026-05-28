"""
Gestor de conexiones WebSocket en memoria para partidas de ajedrez en tiempo real.

Arquitectura:
  - Pool por partida y usuario (no lista plana de sockets).
  - Heartbeat (last_seen) para detectar desconexiones reales sin Redis.
  - Broadcast a todos los jugadores del match con limpieza de sockets muertos.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, Optional

from fastapi import WebSocket

# Intervalo entre revisiones de usuarios inactivos (10–15 s recomendado).
HEARTBEAT_CHECK_INTERVAL_SECONDS = 12

# Tiempo sin actividad antes de expulsar al usuario del match (30–60 s recomendado).
HEARTBEAT_TIMEOUT_SECONDS = 45


class ConnectionManager:
    """
    Administra el ciclo de vida de WebSockets por partida (match) y jugador (user_id).

    Estructura del pool:
        active_connections = {
            "match_id": {
                "user_id": WebSocket
            }
        }

    Beneficios de Dict[match_id][user_id] frente a List[WebSocket]:
      - Identifica jugadores por partida (white/black vía user_id en BD).
      - Evita duplicación: un solo socket activo por usuario en cada match.
      - Reconexión: al recargar la página, el mismo user_id reemplaza el socket anterior.
      - Control de roles: el servicio de partida ya valida blancas/negras; aquí solo enrutamos.
      - Desconexión selectiva: se puede expulsar un jugador sin cerrar la sala entera.
    """

    def __init__(self) -> None:
        # match_id → { user_id → WebSocket }
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}

        # match_id → { user_id → última actividad (mensaje o ping) }
        # Heartbeat: detecta pestañas cerradas, redes caídas o clientes colgados.
        self.last_seen: Dict[str, Dict[str, datetime]] = {}

        self._heartbeat_task: Optional[asyncio.Task] = None

    # -------------------------------------------------------------------------
    # Conexión y reconexión
    # -------------------------------------------------------------------------

    async def connect(self, match_id: str, user_id: str, websocket: WebSocket) -> None:
        """
        Acepta el WebSocket y lo registra bajo match_id + user_id.

        Reconexión (recarga de página):
          Si el usuario ya tenía un socket en este match, se cierra el anterior y se
          sustituye por el nuevo. La partida en BD no se pierde; solo se renueva el canal
          en tiempo real. El oponente sigue viendo el mismo match_id y user_id.
        """
        await websocket.accept()

        if match_id not in self.active_connections:
            self.active_connections[match_id] = {}

        room = self.active_connections[match_id]

        if user_id in room:
            # Reconexión: mismo jugador, nuevo socket (p. ej. F5 o pérdida de red breve).
            old_socket = room[user_id]
            try:
                await old_socket.close(code=1000)
            except Exception:
                pass

        room[user_id] = websocket
        self.update_activity(match_id, user_id)

    def disconnect(self, match_id: str, user_id: str) -> None:
        """
        Elimina un jugador del match y limpia estructuras asociadas.

        Room cleanup:
          Cuando el último usuario sale, se borra la entrada del match en active_connections
          y last_seen. En juegos en tiempo real esto evita fugas de memoria y salas fantasma
          que seguirían recibiendo broadcasts sin jugadores conectados.
        """
        if match_id in self.active_connections:
            self.active_connections[match_id].pop(user_id, None)
            if not self.active_connections[match_id]:
                del self.active_connections[match_id]

        if match_id in self.last_seen:
            self.last_seen[match_id].pop(user_id, None)
            if not self.last_seen[match_id]:
                del self.last_seen[match_id]

    # -------------------------------------------------------------------------
    # Heartbeat / actividad
    # -------------------------------------------------------------------------

    def update_activity(self, match_id: str, user_id: str) -> None:
        """
        Marca al usuario como activo (mensaje de chat, movimiento vía WS, ping, etc.).

        Sin esto, el monitor de heartbeat podría desconectar a jugadores que solo reciben
        eventos por broadcast pero no envían tráfico; por eso el cliente debe enviar ping
        periódico o cualquier mensaje mientras esté en la partida.
        """
        if match_id not in self.last_seen:
            self.last_seen[match_id] = {}
        self.last_seen[match_id][user_id] = datetime.utcnow()

    def start_heartbeat_monitor(self) -> None:
        """Arranca la tarea en segundo plano que revisa last_seen (una sola instancia)."""
        if self._heartbeat_task is None or self._heartbeat_task.done():
            self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

    async def _heartbeat_loop(self) -> None:
        """
        Heartbeat del servidor: cada HEARTBEAT_CHECK_INTERVAL_SECONDS revisa inactividad.

        - Evita partidas colgadas con un jugador “fantasma” tras cerrar la pestaña.
        - Si el cliente deja de enviar tráfico (sin ping/mensajes), se expulsa del pool.
        - No requiere Redis: todo el estado vive en memoria del proceso.
        """
        while True:
            await asyncio.sleep(HEARTBEAT_CHECK_INTERVAL_SECONDS)
            await self._prune_stale_connections()

    async def _prune_stale_connections(self) -> None:
        now = datetime.utcnow()
        deadline = timedelta(seconds=HEARTBEAT_TIMEOUT_SECONDS)
        stale: list[tuple[str, str]] = []

        for match_id, users in list(self.last_seen.items()):
            for user_id, seen_at in list(users.items()):
                if now - seen_at > deadline:
                    stale.append((match_id, user_id))

        for match_id, user_id in stale:
            await self._force_disconnect(match_id, user_id)

    async def _force_disconnect(self, match_id: str, user_id: str) -> None:
        """Cierra el socket inactivo y ejecuta room cleanup vía disconnect()."""
        room = self.active_connections.get(match_id)
        if room and user_id in room:
            ws = room[user_id]
            try:
                await ws.close(code=1000)
            except Exception:
                pass
        self.disconnect(match_id, user_id)

    # -------------------------------------------------------------------------
    # Mensajería
    # -------------------------------------------------------------------------

    async def send_personal_message(self, message: dict, websocket: WebSocket) -> None:
        await websocket.send_json(message)

    async def broadcast_to_match(self, match_id: str, message: dict) -> None:
        """
        Broadcast en arquitectura de juegos multijugador:
          envía el mismo evento (movimiento, chat, fin de partida, etc.) a todos los
          WebSockets del match. En ajedrez online ambos jugadores deben ver el tablero
          y el reloj sincronizados al instante.

        Si un envío falla (socket muerto), se elimina ese user_id del pool para no
        bloquear futuros broadcasts ni iteraciones sobre conexiones rotas.
        """
        if match_id not in self.active_connections:
            return

        room = self.active_connections[match_id]
        for user_id, websocket in list(room.items()):
            try:
                await websocket.send_json(message)
            except Exception:
                self.disconnect(match_id, user_id)


websocket_manager = ConnectionManager()
