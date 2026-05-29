"""
Ciclo de vida explícito del match en memoria.

Fases:
  MATCH_START  → invitación aceptada o matchmaking; estado RAM opcional.
  MATCH_ACTIVE → jugadores conectados y partida en curso.
  MATCH_END    → fin por mate, tiempo, resignación, etc.; limpia RAM y sockets.

Al terminar se evitan fugas de memoria y broadcasts a salas vacías.
"""

from typing import Dict, Optional

from ..core.websocket_manager import websocket_manager
from .events import MatchLifecyclePhase
from .game_state_manager import game_state_manager
from .logging_util import log_realtime


class MatchLifecycleManager:
    def __init__(self) -> None:
        self._phases: Dict[str, MatchLifecyclePhase] = {}

    def get_phase(self, match_id: str) -> Optional[MatchLifecyclePhase]:
        return self._phases.get(match_id)

    def set_phase(self, match_id: str, phase: MatchLifecyclePhase) -> None:
        self._phases[match_id] = phase
        state = game_state_manager.get(match_id)
        if state:
            state.lifecycle_phase = phase
        log_realtime(match_id, "-", phase.value, "Lifecycle phase updated")

    def on_match_start(self, match_id: str) -> None:
        self.set_phase(match_id, MatchLifecyclePhase.MATCH_START)

    def on_match_active(self, match_id: str) -> None:
        self.set_phase(match_id, MatchLifecyclePhase.MATCH_ACTIVE)

    async def on_match_end(self, match_id: str) -> None:
        """
        Fin de partida: marca MATCH_END, elimina estado de tablero y cierra el pool WS.

        Sin limpieza, un cliente reconectado podría recibir un FEN obsoleto de RAM
        o el servidor seguiría iterando sockets muertos del match.
        """
        self.set_phase(match_id, MatchLifecyclePhase.MATCH_END)
        game_state_manager.mark_finished(match_id)
        game_state_manager.remove(match_id)
        self._phases.pop(match_id, None)

        await websocket_manager.disconnect_match(match_id)
        log_realtime(match_id, "-", "MATCH_END", "Match lifecycle ended; state and WS pool cleaned")


match_lifecycle_manager = MatchLifecycleManager()
