"""
Estado de partida en memoria (FEN, turno, historial, fase).

Sin Redis: cada proceso FastAPI mantiene su propio dict match_id → estado.
Tras reinicio del servidor se rehidrata desde BD al primer JOIN/STATE_SYNC/MOVE.

Responsabilidad única: representar el tablero actual para broadcasts y validación
rápida de turno; la persistencia autoritativa sigue en MatchService + PostgreSQL/SQLite.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional

import chess

from ..models.enums import MatchStatus
from .events import MatchLifecyclePhase
from .logging_util import log_realtime

INITIAL_FEN = chess.STARTING_FEN


@dataclass
class MatchGameState:
    match_id: str
    fen: str = INITIAL_FEN
    turn: str = "white"
    move_history: List[str] = field(default_factory=list)
    game_status: str = "active"  # active | finished
    lifecycle_phase: MatchLifecyclePhase = MatchLifecyclePhase.MATCH_START
    white_player_id: Optional[str] = None
    black_player_id: Optional[str] = None
    db_status: Optional[MatchStatus] = None
    movimientos_pgn: Optional[str] = None

    def to_sync_payload(self) -> dict:
        """
        Payload para STATE_SYNC tras reconexión.

        Sin este evento, un cliente que perdió paquetes muestra piezas en casillas
        incorrectas mientras el oponente ve la posición real (desync).
        """
        return {
            "fen": self.fen,
            "turn": self.turn,
            "move_history": list(self.move_history),
            "game_status": self.game_status,
            "lifecycle_phase": self.lifecycle_phase.value,
            "match_status": self.db_status.value if self.db_status else None,
            "movimientos_pgn": self.movimientos_pgn,
        }


class GameStateManager:
    """Pool en memoria: match_id → MatchGameState."""

    def __init__(self) -> None:
        self._states: Dict[str, MatchGameState] = {}

    def get(self, match_id: str) -> Optional[MatchGameState]:
        return self._states.get(match_id)

    def ensure(
        self,
        match_id: str,
        *,
        white_player_id: Optional[str] = None,
        black_player_id: Optional[str] = None,
        db_status: Optional[MatchStatus] = None,
        movimientos_pgn: Optional[str] = None,
        lifecycle_phase: Optional[MatchLifecyclePhase] = None,
    ) -> MatchGameState:
        if match_id not in self._states:
            state = MatchGameState(match_id=match_id)
            self._states[match_id] = state
            log_realtime(match_id, "-", "STATE_INIT", "Created in-memory game state")
        else:
            state = self._states[match_id]

        if white_player_id:
            state.white_player_id = white_player_id
        if black_player_id:
            state.black_player_id = black_player_id
        if db_status is not None:
            state.db_status = db_status
        if movimientos_pgn is not None:
            state.movimientos_pgn = movimientos_pgn
        if lifecycle_phase is not None:
            state.lifecycle_phase = lifecycle_phase

        return state

    def hydrate_from_board(
        self,
        match_id: str,
        board: chess.Board,
        move_history: List[str],
        *,
        white_player_id: str,
        black_player_id: str,
        db_status: MatchStatus,
        movimientos_pgn: Optional[str],
        lifecycle_phase: MatchLifecyclePhase,
    ) -> MatchGameState:
        """Sincroniza RAM desde el tablero reconstruido en BD."""
        state = self.ensure(
            match_id,
            white_player_id=white_player_id,
            black_player_id=black_player_id,
            db_status=db_status,
            movimientos_pgn=movimientos_pgn,
            lifecycle_phase=lifecycle_phase,
        )
        state.fen = board.fen()
        state.turn = "white" if board.turn == chess.WHITE else "black"
        state.move_history = list(move_history)
        state.game_status = (
            "finished" if db_status == MatchStatus.FINISHED else "active"
        )
        return state

    def apply_move(
        self,
        match_id: str,
        *,
        new_fen: str,
        san_move: str,
        next_turn: str,
        game_status: str = "active",
        movimientos_pgn: Optional[str] = None,
    ) -> Optional[MatchGameState]:
        state = self._states.get(match_id)
        if not state:
            return None

        state.fen = new_fen
        state.turn = next_turn
        state.move_history.append(san_move)
        state.game_status = game_status
        if movimientos_pgn is not None:
            state.movimientos_pgn = movimientos_pgn

        log_realtime(
            match_id,
            "-",
            "MOVE",
            f"State updated fen_turn={next_turn} plies={len(state.move_history)}",
        )
        return state

    def mark_finished(self, match_id: str) -> None:
        state = self._states.get(match_id)
        if state:
            state.game_status = "finished"
            state.lifecycle_phase = MatchLifecyclePhase.MATCH_END

    def remove(self, match_id: str) -> None:
        if match_id in self._states:
            del self._states[match_id]
            log_realtime(match_id, "-", "STATE_CLEANUP", "Removed in-memory game state")


game_state_manager = GameStateManager()
