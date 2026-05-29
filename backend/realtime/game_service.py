"""
Lógica de ajedrez para el canal WebSocket (capa 3).

No abre sockets ni parsea JSON crudo:
  - Valida pertenencia al match y turno del jugador.
  - Delega persistencia y ELO a MatchService (BD).
  - Actualiza GameStateManager y emite broadcasts vía protocol.

La separación permite reutilizar MatchService desde HTTP y WS sin duplicar reglas.
"""

import logging
from typing import Any, Dict, Optional

import chess
from fastapi import HTTPException
from sqlmodel import Session

from ..core.websocket_manager import websocket_manager
from ..models.enums import MatchStatus
from ..models.match import Match
from ..services.match_service import MatchService
from .events import EventType, MatchLifecyclePhase
from .game_state_manager import game_state_manager
from .logging_util import log_realtime
from .match_lifecycle import match_lifecycle_manager
from .protocol import broadcast_match_message, emit_message


class RealtimeGameService:
    """Orquesta partida en tiempo real sobre MatchService + estado en RAM."""

    def __init__(self, session: Session) -> None:
        self._session = session
        self._match_service = MatchService(session)

    def _load_match(self, match_id: str) -> Optional[Match]:
        return self._match_service.match_repo.find_by_id(int(match_id))

    def _build_move_history(self, match: Match) -> list[str]:
        board = self._match_service._build_board_from_stored_pgn(match.movimientos_pgn)
        history: list[str] = []
        replay = chess.Board()
        for move in board.move_stack:
            history.append(replay.san(move))
            replay.push(move)
        return history

    def sync_state_from_db(self, match_id: str) -> Optional[dict]:
        """Rehidrata RAM desde BD (reconexión o primer acceso)."""
        match = self._load_match(match_id)
        if not match:
            return None

        board = self._match_service._build_board_from_stored_pgn(match.movimientos_pgn)
        history = self._build_move_history(match)

        if match.estado == MatchStatus.IN_PROGRESS:
            phase = MatchLifecyclePhase.MATCH_ACTIVE
            match_lifecycle_manager.on_match_active(str(match.id))
        elif match.estado == MatchStatus.FINISHED:
            phase = MatchLifecyclePhase.MATCH_END
        else:
            phase = MatchLifecyclePhase.MATCH_START
            match_lifecycle_manager.on_match_start(str(match.id))

        state = game_state_manager.hydrate_from_board(
            str(match.id),
            board,
            history,
            white_player_id=str(match.jugador_blancas_id),
            black_player_id=str(match.jugador_negras_id),
            db_status=match.estado,
            movimientos_pgn=match.movimientos_pgn,
            lifecycle_phase=phase,
        )

        payload = state.to_sync_payload()
        payload["board_state"] = payload["fen"]
        payload["tiempo_restante_blancas"] = match.tiempo_restante_blancas
        payload["tiempo_restante_negras"] = match.tiempo_restante_negras
        if match.ultima_jugada_en:
            payload["ultima_jugada_en"] = match.ultima_jugada_en.isoformat()
        return payload

    def validate_participant(self, match: Match, user_id: int) -> str:
        """Devuelve 'white' | 'black' o lanza HTTPException (HTTP REST)."""
        if user_id == match.jugador_blancas_id:
            return "white"
        if user_id == match.jugador_negras_id:
            return "black"
        raise HTTPException(status_code=403, detail="You are not a participant in this match")

    def _ws_participant_check(
        self, match: Match, user_id: int
    ) -> tuple[Optional[str], Optional[Dict[str, Any]]]:
        """Validación para WebSocket: devuelve (color, error_envelope)."""
        try:
            return self.validate_participant(match, user_id), None
        except HTTPException as exc:
            return None, emit_message(
                EventType.ERROR,
                {"code": "NOT_PARTICIPANT", "detail": exc.detail},
            )

    def _ws_can_play_check(
        self, match: Match, user_id: int
    ) -> tuple[Optional[str], Optional[Dict[str, Any]]]:
        if match.estado != MatchStatus.IN_PROGRESS:
            return None, emit_message(
                EventType.ERROR,
                {"code": "MATCH_NOT_ACTIVE"},
            )
        return self._ws_participant_check(match, user_id)

    def validate_can_play(self, match: Match, user_id: int) -> str:
        if match.estado != MatchStatus.IN_PROGRESS:
            raise HTTPException(status_code=400, detail="Match is not active")
        return self.validate_participant(match, user_id)

    async def handle_join(self, match_id: str, user_id: int) -> Dict[str, Any]:
        """JOIN: confirma participación y devuelve STATE_SYNC para el cliente."""
        match = self._load_match(match_id)
        if not match:
            return emit_message(EventType.ERROR, {"code": "MATCH_NOT_FOUND"})

        _, err = self._ws_participant_check(match, user_id)
        if err:
            return err
        sync_payload = self.sync_state_from_db(match_id) or {}

        if match.estado == MatchStatus.IN_PROGRESS:
            match_lifecycle_manager.on_match_active(match_id)

        log_realtime(match_id, str(user_id), "JOIN", "Player joined realtime channel")
        return emit_message(EventType.STATE_SYNC, sync_payload)

    async def handle_move(
        self, match_id: str, user_id: int, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        move_str = payload.get("move")
        if not move_str:
            return emit_message(EventType.ERROR, {"code": "MISSING_MOVE"})

        match = self._load_match(match_id)
        if not match:
            return emit_message(EventType.ERROR, {"code": "MATCH_NOT_FOUND"})

        color, err = self._ws_can_play_check(match, user_id)
        if err:
            return err

        if game_state_manager.get(match_id) is None:
            self.sync_state_from_db(match_id)

        state = game_state_manager.get(match_id)
        if state and state.turn != color:
            log_realtime(
                match_id,
                str(user_id),
                "MOVE_REJECTED",
                f"Not player's turn (expected {state.turn})",
                level=logging.WARNING,
            )
            return emit_message(
                EventType.ERROR,
                {"code": "WRONG_TURN", "expected_turn": state.turn},
            )

        from ..schemas.match import MoveRequest

        try:
            result = self._match_service.make_move(
                int(match_id), user_id, MoveRequest(move=move_str)
            )
        except HTTPException as exc:
            return emit_message(
                EventType.ERROR,
                {"code": "MOVE_INVALID", "detail": exc.detail},
            )

        broadcast = result["broadcast_payload"]
        next_turn = broadcast.get("turn", "white")

        game_state_manager.apply_move(
            match_id,
            new_fen=broadcast.get("board_state", ""),
            san_move=broadcast.get("move", move_str),
            next_turn=next_turn,
            game_status="finished"
            if broadcast.get("match_status") == MatchStatus.FINISHED.value
            or broadcast.get("match_status") == "finished"
            else "active",
            movimientos_pgn=broadcast.get("movimientos_pgn"),
        )

        log_realtime(match_id, str(user_id), "MOVE", f"Move applied: {broadcast.get('move')}")

        await broadcast_match_message(match_id, EventType.MOVE, broadcast)

        if broadcast.get("match_status") in (
            MatchStatus.FINISHED.value,
            "finished",
        ):
            await match_lifecycle_manager.on_match_end(match_id)

        return emit_message(EventType.MOVE, broadcast)

    async def handle_resign(
        self, match_id: str, user_id: int, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        from ..schemas.match import EndMatchRequest

        match = self._load_match(match_id)
        if not match:
            return emit_message(EventType.ERROR, {"code": "MATCH_NOT_FOUND"})

        _, err = self._ws_can_play_check(match, user_id)
        if err:
            return err

        try:
            result = self._match_service.end_match(
                int(match_id), user_id, EndMatchRequest(reason="resignation")
            )
        except HTTPException as exc:
            return emit_message(EventType.ERROR, {"code": "RESIGN_FAILED", "detail": exc.detail})

        broadcast = result["broadcast_payload"]
        await broadcast_match_message(match_id, EventType.MATCH_ENDED, broadcast)
        await match_lifecycle_manager.on_match_end(match_id)

        log_realtime(match_id, str(user_id), "RESIGN", "Player resigned")
        return emit_message(EventType.MATCH_ENDED, broadcast)

    async def handle_draw_offer(
        self, match_id: str, user_id: int, username: str
    ) -> None:
        match = self._load_match(match_id)
        if not match:
            return
        _, err = self._ws_participant_check(match, user_id)
        if err:
            return
        await broadcast_match_message(
            match_id,
            EventType.DRAW_OFFER,
            {"offered_by": username},
        )

    async def handle_draw_declined(
        self, match_id: str, user_id: int, username: str
    ) -> None:
        match = self._load_match(match_id)
        if not match:
            return
        _, err = self._ws_participant_check(match, user_id)
        if err:
            return
        await broadcast_match_message(
            match_id,
            EventType.DRAW_DECLINED,
            {"declined_by": username},
        )

    async def handle_draw_agreement(
        self, match_id: str, user_id: int, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        from ..schemas.match import EndMatchRequest

        if not payload.get("accept"):
            return emit_message(EventType.ERROR, {"code": "DRAW_NOT_ACCEPTED"})

        match = self._load_match(match_id)
        if not match:
            return emit_message(EventType.ERROR, {"code": "MATCH_NOT_FOUND"})

        _, err = self._ws_can_play_check(match, user_id)
        if err:
            return err

        try:
            result = self._match_service.end_match(
                int(match_id), user_id, EndMatchRequest(reason="draw")
            )
        except HTTPException as exc:
            return emit_message(EventType.ERROR, {"code": "DRAW_FAILED", "detail": exc.detail})

        broadcast = result["broadcast_payload"]
        await broadcast_match_message(match_id, EventType.MATCH_ENDED, broadcast)
        await match_lifecycle_manager.on_match_end(match_id)

        log_realtime(match_id, str(user_id), "DRAW", "Draw agreed")
        return emit_message(EventType.MATCH_ENDED, broadcast)

    async def handle_chat(
        self,
        match_id: str,
        user_id: int,
        username: str,
        payload: Dict[str, Any],
    ) -> None:
        match = self._load_match(match_id)
        if not match:
            return
        _, err = self._ws_participant_check(match, user_id)
        if err:
            return
        message = payload.get("message", "")
        await broadcast_match_message(
            match_id,
            EventType.CHAT,
            {"username": username, "message": message},
        )

    @staticmethod
    def build_state_sync_envelope(sync_payload: dict) -> Dict[str, Any]:
        return emit_message(EventType.STATE_SYNC, sync_payload)

    @staticmethod
    async def apply_http_move_side_effects(
        match_id: str, broadcast_payload: dict
    ) -> None:
        """Sincroniza RAM y emite MOVE tras POST HTTP /move."""
        next_turn = broadcast_payload.get("turn", "white")
        game_state_manager.apply_move(
            str(match_id),
            new_fen=broadcast_payload.get("board_state", ""),
            san_move=broadcast_payload.get("move", ""),
            next_turn=next_turn,
            game_status="finished"
            if broadcast_payload.get("match_status") in ("finished", MatchStatus.FINISHED.value)
            else "active",
            movimientos_pgn=broadcast_payload.get("movimientos_pgn"),
        )
        await broadcast_match_message(str(match_id), EventType.MOVE, broadcast_payload)
        if broadcast_payload.get("match_status") in (
            MatchStatus.FINISHED.value,
            "finished",
        ):
            await match_lifecycle_manager.on_match_end(str(match_id))

    @staticmethod
    async def apply_http_match_end_side_effects(
        match_id: str, broadcast_payload: dict
    ) -> None:
        await broadcast_match_message(
            str(match_id), EventType.MATCH_ENDED, broadcast_payload
        )
        await match_lifecycle_manager.on_match_end(str(match_id))

    async def apply_http_match_started_side_effects(
        self, match_id: str, broadcast_payload: dict
    ) -> None:
        self.sync_state_from_db(str(match_id))
        match_lifecycle_manager.on_match_active(str(match_id))
        await websocket_manager.broadcast_to_match(str(match_id), broadcast_payload)
