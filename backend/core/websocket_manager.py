"""
Capa 1 — Transporte WebSocket (sin lógica de ajedrez ni enrutamiento de eventos).

Responsabilidades exclusivas:
  - Aceptar/cerrar conexiones y mantener pool match_id → user_id → WebSocket.
  - Broadcast y mensajes personales.
  - Heartbeat (last_seen) para expulsar clientes inactivos.

La lógica de partida vive en `backend.realtime` (EventRouter, GameService).
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional

from fastapi import WebSocket

logger = logging.getLogger("chess.websocket")

# Intervalo entre revisiones de usuarios inactivos (10–15 s recomendado).
HEARTBEAT_CHECK_INTERVAL_SECONDS = 12

# Tiempo sin actividad antes de expulsar al usuario del match (30–60 s recomendado).
HEARTBEAT_TIMEOUT_SECONDS = 45


class ConnectionManager:
    def __init__(self):
        # Maps match_id to a list of active WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, match_id: str, websocket: WebSocket):
        await websocket.accept()

        if match_id not in self.active_connections:
            self.active_connections[match_id] = {}

        room = self.active_connections[match_id]

        if is_reconnect:
            old_socket = room[user_id]
            try:
                await old_socket.close(code=1000)
            except Exception:
                pass
            self._log(match_id, user_id, "RECONNECT", "Replaced stale socket")
        else:
            self._log(match_id, user_id, "CONNECT", "WebSocket accepted")

    def disconnect(self, match_id: str, websocket: WebSocket):
        if match_id in self.active_connections:
            self.active_connections[match_id].pop(user_id, None)
            if not self.active_connections[match_id]:
                del self.active_connections[match_id]

        if match_id in self.last_seen:
            self.last_seen[match_id].pop(user_id, None)
            if not self.last_seen[match_id]:
                del self.last_seen[match_id]

        self._log(match_id, user_id, "DISCONNECT", "Removed from pool")

    async def disconnect_match(self, match_id: str) -> None:
        """Cierra todos los sockets de un match (fin de partida / limpieza)."""
        room = self.active_connections.get(match_id, {})
        for user_id, ws in list(room.items()):
            try:
                await ws.close(code=1000)
            except Exception:
                pass
            self.disconnect(match_id, user_id)
        self._log(match_id, "-", "MATCH_CLEANUP", "All connections closed for match")

    def update_activity(self, match_id: str, user_id: str) -> None:
        """Marca actividad reciente; debe invocarse en cada evento entrante."""
        if match_id not in self.last_seen:
            self.last_seen[match_id] = {}
        self.last_seen[match_id][user_id] = datetime.utcnow()

    def start_heartbeat_monitor(self) -> None:
        if self._heartbeat_task is None or self._heartbeat_task.done():
            self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

    async def _heartbeat_loop(self) -> None:
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
            self._log(
                match_id,
                user_id,
                "HEARTBEAT_TIMEOUT",
                f"Inactive >{HEARTBEAT_TIMEOUT_SECONDS}s",
            )
            await self._force_disconnect(match_id, user_id)

    async def _force_disconnect(self, match_id: str, user_id: str) -> None:
        room = self.active_connections.get(match_id)
        if room and user_id in room:
            ws = room[user_id]
            try:
                await ws.close(code=1000)
            except Exception:
                pass
        self.disconnect(match_id, user_id)

    async def send_personal_message(self, message: dict, websocket: WebSocket) -> None:
        try:
            await websocket.send_json(message)
        except Exception:
            logger.warning("Failed to send personal message — socket may be closing")

    async def broadcast_to_match(self, match_id: str, message: dict) -> None:
        if match_id not in self.active_connections:
            return

        room = self.active_connections[match_id]
        for user_id, websocket in list(room.items()):
            try:
                await websocket.send_json(message)
            except Exception:
                self.disconnect(match_id, user_id)

    async def broadcast_to_match(self, match_id: str, message: dict):
        if match_id in self.active_connections:
            # Create a copy of the list to avoid modification issues during iteration
            for connection in list(self.active_connections[match_id]):
                try:
                    await connection.send_json(message)
                except Exception:
                    # Connection might be dead, remove it safely
                    self.disconnect(match_id, connection)

websocket_manager = ConnectionManager()
