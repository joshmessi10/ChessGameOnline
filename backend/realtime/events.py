"""
Tipos de evento del protocolo WebSocket.

¿Por qué un sistema basado en eventos?
  - El transporte (WebSocket) no debe conocer reglas de ajedrez ni SQL.
  - Cada `EventType` es un contrato estable entre cliente y servidor.
  - Añadir tablas, relojes o torneos = nuevo tipo + handler, sin tocar ConnectionManager.
  - Facilita pruebas: el router se prueba con dicts, sin sockets reales.
"""

from enum import Enum


class EventType(str, Enum):
    """Mensajes entrantes y salientes del canal en tiempo real."""

    MOVE = "MOVE"
    JOIN = "JOIN"
    RESIGN = "RESIGN"
    DRAW = "DRAW"
    PING = "PING"
    PONG = "PONG"
    STATE_SYNC = "STATE_SYNC"
    ERROR = "ERROR"
    CHAT = "CHAT"
    DRAW_OFFER = "DRAW_OFFER"
    DRAW_DECLINED = "DRAW_DECLINED"
    MATCH_ENDED = "MATCH_ENDED"


class MatchLifecyclePhase(str, Enum):
    """
    Ciclo de vida en memoria (complementa MatchStatus en BD).

    MATCH_START  → partida creada/aceptada, aún puede no tener estado en RAM.
    MATCH_ACTIVE → hay estado de tablero y jugadores pueden jugar.
    MATCH_END    → partida cerrada; se limpia RAM y pool WS del match.
    """

    MATCH_START = "MATCH_START"
    MATCH_ACTIVE = "MATCH_ACTIVE"
    MATCH_END = "MATCH_END"
