"""
Construcción y emisión de mensajes WebSocket con envoltura { type, payload }.

Compatibilidad: el frontend histórico espera tipos planos (`move_made`, `match_started`).
`to_legacy_broadcast` aplana el envelope para no romper clientes existentes mientras
migran al protocolo unificado.
"""

from typing import Any, Dict, Optional

from ..core.websocket_manager import websocket_manager
from .events import EventType


# Mapeo envelope → tipo legacy en cliente
_LEGACY_OUTGOING_MAP: Dict[EventType, str] = {
    EventType.MOVE: "move_made",
    EventType.MATCH_ENDED: "match_ended",
    EventType.STATE_SYNC: "state_sync",
    EventType.DRAW_OFFER: "draw_offer",
    EventType.DRAW_DECLINED: "draw_declined",
    EventType.CHAT: "chat",
    EventType.PONG: "pong",
    EventType.ERROR: "error",
}


def emit_message(event_type: EventType, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Crea el mensaje estándar { type, payload }."""
    return {
        "type": event_type.value,
        "payload": payload or {},
    }


def to_legacy_broadcast(envelope: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convierte envelope a formato plano para clientes que aún no leen `payload`.

    Si el tipo ya es legacy (p. ej. match_started desde HTTP), se devuelve tal cual.
    """
    raw_type = envelope.get("type", "")
    payload = envelope.get("payload")

    if payload is None:
        return envelope

    try:
        event_type = EventType(raw_type)
    except ValueError:
        return envelope

    legacy_type = _LEGACY_OUTGOING_MAP.get(event_type)
    if not legacy_type:
        return envelope

    return {"type": legacy_type, **payload}


def parse_incoming(raw: Dict[str, Any]) -> tuple[EventType, Dict[str, Any]]:
    """
    Acepta protocolo nuevo ({ type: MOVE, payload: {} }) o legacy ({ type: ping }).

    Normaliza el nombre del evento a mayúsculas para el router interno.
    """
    raw_type = str(raw.get("type", "")).strip()
    payload = raw.get("payload")

    if payload is None:
        payload = {k: v for k, v in raw.items() if k != "type"}

    legacy_aliases = {
        "ping": EventType.PING,
        "pong": EventType.PONG,
        "chat": EventType.CHAT,
        "draw_offer": EventType.DRAW_OFFER,
        "draw_declined": EventType.DRAW_DECLINED,
        "move": EventType.MOVE,
        "join": EventType.JOIN,
        "resign": EventType.RESIGN,
        "draw": EventType.DRAW,
        "state_sync": EventType.STATE_SYNC,
    }

    lower = raw_type.lower()
    if lower in legacy_aliases:
        return legacy_aliases[lower], payload

    try:
        return EventType(raw_type.upper()), payload
    except ValueError:
        raise ValueError(f"Unknown event type: {raw_type}")


async def broadcast_match_message(
    match_id: str,
    event_type: EventType,
    payload: Optional[Dict[str, Any]] = None,
    *,
    use_legacy_wire_format: bool = True,
) -> None:
    """Envía un evento a todos los sockets del match."""
    envelope = emit_message(event_type, payload)
    wire = to_legacy_broadcast(envelope) if use_legacy_wire_format else envelope
    await websocket_manager.broadcast_to_match(match_id, wire)


async def send_personal_message(
    websocket,
    event_type: EventType,
    payload: Optional[Dict[str, Any]] = None,
    *,
    use_legacy_wire_format: bool = True,
) -> None:
    """Envía un evento a un solo socket (p. ej. STATE_SYNC en reconexión)."""
    envelope = emit_message(event_type, payload)
    wire = to_legacy_broadcast(envelope) if use_legacy_wire_format else envelope
    await websocket_manager.send_personal_message(wire, websocket)
