"""
Event Router (capa 2): centraliza mensajes WebSocket entrantes.

Flujo:
  1. ConnectionManager entrega texto JSON al router.
  2. `parse_incoming` normaliza tipo + payload.
  3. Se actualiza heartbeat (`update_activity`) en TODO evento.
  4. Se delega a RealtimeGameService sin conocer reglas de ajedrez aquí.

Escalar el juego = añadir EventType + método en GameService + rama en `route`.
El WebSocketManager nunca importa python-chess ni SQLModel.
"""

import json
from typing import Any, Dict, Optional

from fastapi import WebSocket
from sqlmodel import Session

from ..core.websocket_manager import websocket_manager
from .events import EventType
from .game_service import RealtimeGameService
from .logging_util import log_realtime
from .protocol import parse_incoming, send_personal_message

# Eventos que ya hacen broadcast a la sala; no reenviar copia personal al emisor.
_BROADCAST_ONLY_RESPONSES = frozenset(
    {EventType.MOVE, EventType.MATCH_ENDED, EventType.CHAT, EventType.DRAW_OFFER, EventType.DRAW_DECLINED}
)


class EventRouter:
    async def route(
        self,
        *,
        match_id: str,
        user_id: str,
        username: str,
        websocket: WebSocket,
        raw_text: str,
        session: Session,
    ) -> None:
        websocket_manager.update_activity(match_id, user_id)

        try:
            raw = json.loads(raw_text)
        except json.JSONDecodeError:
            await send_personal_message(
                websocket,
                EventType.ERROR,
                {"code": "INVALID_JSON"},
            )
            return

        if not isinstance(raw, dict):
            await send_personal_message(
                websocket,
                EventType.ERROR,
                {"code": "INVALID_MESSAGE"},
            )
            return

        try:
            event_type, payload = parse_incoming(raw)
        except ValueError as exc:
            await send_personal_message(
                websocket,
                EventType.ERROR,
                {"code": "UNKNOWN_EVENT", "detail": str(exc)},
            )
            return

        log_realtime(match_id, user_id, event_type.value, "Incoming event")

        game_service = RealtimeGameService(session)
        response: Optional[Dict[str, Any]] = None

        if event_type == EventType.PING:
            await send_personal_message(websocket, EventType.PONG, {})
            return

        if event_type == EventType.JOIN:
            response = await game_service.handle_join(match_id, int(user_id))
        elif event_type == EventType.MOVE:
            response = await game_service.handle_move(match_id, int(user_id), payload)
        elif event_type == EventType.RESIGN:
            response = await game_service.handle_resign(match_id, int(user_id), payload)
        elif event_type == EventType.DRAW:
            if payload.get("action") == "offer":
                await game_service.handle_draw_offer(match_id, int(user_id), username)
                return
            if payload.get("action") == "decline":
                await game_service.handle_draw_declined(match_id, int(user_id), username)
                return
            response = await game_service.handle_draw_agreement(
                match_id, int(user_id), payload
            )
        elif event_type == EventType.CHAT:
            await game_service.handle_chat(match_id, int(user_id), username, payload)
            return
        elif event_type == EventType.DRAW_OFFER:
            await game_service.handle_draw_offer(match_id, int(user_id), username)
            return
        elif event_type == EventType.DRAW_DECLINED:
            await game_service.handle_draw_declined(match_id, int(user_id), username)
            return
        elif event_type == EventType.STATE_SYNC:
            sync_payload = game_service.sync_state_from_db(match_id)
            response = RealtimeGameService.build_state_sync_envelope(sync_payload or {})
        else:
            await send_personal_message(
                websocket,
                EventType.ERROR,
                {"code": "UNSUPPORTED_EVENT", "type": event_type.value},
            )
            return

        if response and event_type not in _BROADCAST_ONLY_RESPONSES:
            await send_personal_message(
                websocket,
                EventType(response["type"]),
                response.get("payload", {}),
            )

    async def on_player_connected(
        self,
        *,
        match_id: str,
        user_id: str,
        websocket: WebSocket,
        session: Session,
        is_reconnect: bool,
    ) -> None:
        """
        Tras accept(): envía STATE_SYNC automático.

        En ajedrez en tiempo real, sin sincronización el cliente puede mostrar
        un tablero desfasado (movimientos perdidos durante desconexión breve).
        """
        game_service = RealtimeGameService(session)
        sync_payload = game_service.sync_state_from_db(match_id) or {}

        if match_id and sync_payload:
            from ..models.enums import MatchStatus
            from .match_lifecycle import match_lifecycle_manager

            match_row = game_service._load_match(match_id)
            if match_row and match_row.estado == MatchStatus.IN_PROGRESS:
                match_lifecycle_manager.on_match_active(match_id)

        event_label = "RECONNECT" if is_reconnect else "CONNECT"
        log_realtime(
            match_id,
            user_id,
            event_label,
            f"Sending STATE_SYNC ({len(sync_payload.get('move_history', []))} moves)",
        )

        await send_personal_message(
            websocket,
            EventType.STATE_SYNC,
            sync_payload,
        )


event_router = EventRouter()
