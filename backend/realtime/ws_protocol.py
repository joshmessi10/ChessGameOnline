"""
Contrato de mensajes WebSocket (referencia para cliente y servidor).

Mensaje estándar:
    { "type": "<EventType>", "payload": { ... } }

Entrantes (cliente → servidor):
    PING          {}  — heartbeat; el servidor responde PONG
    JOIN          {}  — opcional; al conectar ya se envía STATE_SYNC
    MOVE          { "move": "e4" | "e2e4" }
    RESIGN        {}
    DRAW          { "action": "offer" | "decline" } o { "accept": true }
    STATE_SYNC    {}  — solicitar resincronización manual
    CHAT          { "message": "..." }

Salientes (servidor → cliente):
    PONG, STATE_SYNC, MOVE (→ legacy move_made), MATCH_ENDED, ERROR, CHAT, ...

Legacy: también se aceptan tipos en minúsculas (`ping`, `chat`, `move`).
Salida hacia el cliente usa formato plano legacy cuando `use_legacy_wire_format=True`.
"""

from .events import EventType

__all__ = ["EventType"]
