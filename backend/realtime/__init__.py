"""
Capa de tiempo real: eventos WebSocket, estado en memoria y ciclo de vida de partidas.

Separación respecto a HTTP/BD:
  - `core.websocket_manager` → solo transporte (sockets, broadcast, heartbeat).
  - `realtime.event_router` → enrutamiento de mensajes entrantes.
  - `realtime.game_service` → reglas de ajedrez y validación.
  - `realtime.game_state_manager` → FEN, turno e historial en memoria.
"""

from .event_router import event_router
from .game_state_manager import game_state_manager
from .match_lifecycle import match_lifecycle_manager
from .protocol import broadcast_match_message, emit_message
from .ws_protocol import EventType as WsEventType

__all__ = [
    "event_router",
    "game_state_manager",
    "match_lifecycle_manager",
    "broadcast_match_message",
    "emit_message",
    "WsEventType",
]
