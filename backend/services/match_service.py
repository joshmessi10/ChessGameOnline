from datetime import datetime, timezone
import math
from typing import Optional, List
from fastapi import HTTPException
from sqlmodel import Session
from ..repositories.match_repository import MatchRepository
from ..repositories.rating_repository import RatingRepository
from ..repositories.statistics_repository import StatisticsRepository
from ..models.match import Match
from ..models.enums import MatchStatus, MatchResult
from ..schemas.match import MatchResponse, MoveRequest, MoveResponse, EndMatchRequest, EndMatchResponse
from ..schemas.invite import InviteRequest, InviteResponse
import chess
from ..core.chess_engine import ChessEngine

class MatchService:
    def __init__(self, session: Session):
        from ..repositories.usuario_repository import UsuarioRepository
        self.match_repo = MatchRepository(session)
        self.rating_repo = RatingRepository(session)
        self.stats_repo = StatisticsRepository(session)
        self.user_repo = UsuarioRepository(session)


    def get_match(self, match_id: int, user_id: int) -> MatchResponse:
        match = self.match_repo.find_by_id(match_id)
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")
        if user_id not in (match.jugador_blancas_id, match.jugador_negras_id):
            raise HTTPException(status_code=403, detail="You are not a participant in this match")
        self._ensure_match_clocks_initialized(match)
        self.check_and_apply_timeout(match.id)
        # Fetch updated record
        match = self.match_repo.find_by_id(match_id)
        return self._map_to_response(match)

    def _ensure_match_clocks_initialized(self, match: Match) -> None:
        if match.estado != MatchStatus.IN_PROGRESS:
            return
        if match.tiempo_restante_blancas is not None and match.tiempo_restante_negras is not None and match.ultima_jugada_en is not None:
            return

        initial_seconds, _ = self._parse_control_tiempo(match.control_tiempo)
        if match.tiempo_restante_blancas is None:
            match.tiempo_restante_blancas = float(initial_seconds)
        if match.tiempo_restante_negras is None:
            match.tiempo_restante_negras = float(initial_seconds)
        if match.ultima_jugada_en is None:
            match.ultima_jugada_en = datetime.now(timezone.utc)
        self.match_repo.update(match)

    def _finalize_match_ratings_and_stats(self, match: Match, result: MatchResult) -> tuple:
        from ..models.statistics import Statistics
        # Basic ELO Logic
        k = 32
        white_rating = self.rating_repo.find_by_usuario_and_modo(match.jugador_blancas_id, match.modo)
        black_rating = self.rating_repo.find_by_usuario_and_modo(match.jugador_negras_id, match.modo)
        
        rw = white_rating.rating if white_rating else 1200
        rb = black_rating.rating if black_rating else 1200
        
        ew = 1 / (1 + 10 ** ((rb - rw) / 400))
        eb = 1 / (1 + 10 ** ((rw - rb) / 400))
        
        # Determine actual scores
        if result == MatchResult.WHITE_WIN:
            sw, sb = 1, 0
        elif result == MatchResult.BLACK_WIN:
            sw, sb = 0, 1
        else: # DRAW
            sw, sb = 0.5, 0.5
            
        new_rw = rw + k * (sw - ew)
        new_rb = rb + k * (sb - eb)
        
        # Update ratings in DB
        if white_rating:
            white_rating.rating = int(new_rw)
            self.rating_repo.update(white_rating)
        else:
            from ..models.rating import Rating
            white_rating = Rating(usuario_id=match.jugador_blancas_id, modo=match.modo, rating=int(new_rw))
            self.rating_repo.save(white_rating)
            
        if black_rating:
            black_rating.rating = int(new_rb)
            self.rating_repo.update(black_rating)
        else:
            from ..models.rating import Rating
            black_rating = Rating(usuario_id=match.jugador_negras_id, modo=match.modo, rating=int(new_rb))
            self.rating_repo.save(black_rating)

        # Update career statistics in DB
        stats_w = self.stats_repo.find_by_usuario_id(match.jugador_blancas_id)
        if not stats_w:
            stats_w = Statistics(usuario_id=match.jugador_blancas_id)
            stats_w = self.stats_repo.save(stats_w)
            
        stats_b = self.stats_repo.find_by_usuario_id(match.jugador_negras_id)
        if not stats_b:
            stats_b = Statistics(usuario_id=match.jugador_negras_id)
            stats_b = self.stats_repo.save(stats_b)

        stats_w.partidas_jugadas += 1
        stats_b.partidas_jugadas += 1
        
        if result == MatchResult.WHITE_WIN:
            stats_w.victorias += 1
            stats_b.derrotas += 1
        elif result == MatchResult.BLACK_WIN:
            stats_b.victorias += 1
            stats_w.derrotas += 1
        elif result == MatchResult.DRAW:
            stats_w.empates += 1
            stats_b.empates += 1

        stats_w.actualizado_en = datetime.now(timezone.utc)
        stats_b.actualizado_en = datetime.now(timezone.utc)
        
        self.stats_repo.update(stats_w)
        self.stats_repo.update(stats_b)

        change_w = int(new_rw) - rw
        change_b = int(new_rb) - rb
        match.elo_change_blancas = change_w
        match.elo_change_negras = change_b

        return int(new_rw), int(new_rb), change_w, change_b


    def end_match(self, match_id: int, user_id: int, request: EndMatchRequest) -> dict:
        match = self.match_repo.find_by_id(match_id)
        if not match or match.estado != MatchStatus.IN_PROGRESS:
            raise HTTPException(status_code=400, detail="Match not active")
        if user_id not in (match.jugador_blancas_id, match.jugador_negras_id):
            raise HTTPException(status_code=403, detail="You are not a participant in this match")
            
        # Determine match result based on user resigning or drawing
        if request.reason in ("victory", "resignation"):
            if user_id == match.jugador_blancas_id:
                # White resigned -> Black wins
                result = MatchResult.BLACK_WIN
                match.resultado = MatchResult.BLACK_WIN
                match.ganador_id = match.jugador_negras_id
            else:
                # Black resigned -> White wins
                result = MatchResult.WHITE_WIN
                match.resultado = MatchResult.WHITE_WIN
                match.ganador_id = match.jugador_blancas_id
        else:
            result = MatchResult.DRAW
            match.resultado = MatchResult.DRAW

        new_rw, new_rb, change_w, change_b = self._finalize_match_ratings_and_stats(match, result)
            
        match.estado = MatchStatus.FINISHED
        match.finalizada_en = datetime.now(timezone.utc)
        self.match_repo.update(match)
        
        broadcast_payload = {
            "type": "match_ended",
            "reason": request.reason,
            "end_reason": request.reason,
            "winner_id": match.ganador_id,
            "resultado": match.resultado.value if hasattr(match.resultado, "value") else match.resultado,
            "newELOPlayerWhite": new_rw,
            "newELOPlayerBlack": new_rb,
            "eloChangePlayerWhite": change_w,
            "eloChangePlayerBlack": change_b
        }
        
        return {
            "response": EndMatchResponse(
                match_id=match.id,
                result=match.resultado,
                final_pgn=match.movimientos_pgn or "",
                newELOPlayerWhite=new_rw,
                newELOPlayerBlack=new_rb,
                eloChangePlayerWhite=change_w,
                eloChangePlayerBlack=change_b
            ),
            "broadcast_payload": broadcast_payload
        }


    def send_invite(self, host_id: int, request: InviteRequest) -> InviteResponse:
        if host_id == request.friend_id:
            raise HTTPException(status_code=400, detail="You cannot challenge yourself")

        existing = self.match_repo.find_pending_between_players(host_id, request.friend_id)
        if existing:
            raise HTTPException(status_code=409, detail="There is already a pending challenge between these players")

        new_match = Match(
            jugador_blancas_id=host_id,
            jugador_negras_id=request.friend_id,
            modo=request.modo,
            control_tiempo=request.control_tiempo,
            estado=MatchStatus.WAITING
        )
        saved = self.match_repo.save(new_match)
        return InviteResponse(
            id=saved.id,
            inviter_id=host_id,
            invited_id=request.friend_id,
            status="pending",
            message="Challenge sent successfully"
        )

    def join_match(self, match_id: int, user_id: int) -> dict:
        match = self.match_repo.find_by_id(match_id)
        if not match:
            raise HTTPException(status_code=404, detail="Invitation match not found")
        if match.estado != MatchStatus.WAITING:
            raise HTTPException(status_code=400, detail="Match is already in progress, finished, or cancelled")
        if user_id != match.jugador_negras_id:
            raise HTTPException(status_code=403, detail="Only the invited player can accept this challenge")

        match.estado = MatchStatus.IN_PROGRESS
        
        # Parse time control and set initial times and last move timestamp
        initial_seconds, _ = self._parse_control_tiempo(match.control_tiempo)
        match.tiempo_restante_blancas = float(initial_seconds)
        match.tiempo_restante_negras = float(initial_seconds)
        match.ultima_jugada_en = datetime.now(timezone.utc)
        
        updated = self.match_repo.update(match)

        broadcast_payload = {
            "type": "match_started",
            "match_id": updated.id,
            "board_state": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            "turn": "white",
            "match_status": "in_progress",
            "tiempo_restante_blancas": updated.tiempo_restante_blancas,
            "tiempo_restante_negras": updated.tiempo_restante_negras,
            "ultima_jugada_en": updated.ultima_jugada_en.isoformat() if updated.ultima_jugada_en else None
        }

        return {
            "response": InviteResponse(
                id=updated.id,
                inviter_id=updated.jugador_blancas_id,
                invited_id=updated.jugador_negras_id,
                status="accepted",
                message="Invitation accepted, match started!"
            ),
            "broadcast_payload": broadcast_payload
        }

    def decline_invite(self, match_id: int, user_id: int) -> dict:
        match = self.match_repo.find_by_id(match_id)
        if not match:
            raise HTTPException(status_code=404, detail="Invitation match not found")
        if match.estado != MatchStatus.WAITING:
            raise HTTPException(status_code=400, detail="Match is already in progress, finished, or cancelled")
        if user_id not in (match.jugador_blancas_id, match.jugador_negras_id):
            raise HTTPException(status_code=403, detail="You are not a participant in this invitation")

        is_host = user_id == match.jugador_blancas_id
        action = "cancelled" if is_host else "declined"

        match.estado = MatchStatus.CANCELLED
        updated = self.match_repo.update(match)

        broadcast_payload = {
            "type": "match_cancelled",
            "match_id": updated.id,
            "message": f"Challenge {action}"
        }

        return {
            "response": InviteResponse(
                id=updated.id,
                inviter_id=updated.jugador_blancas_id,
                invited_id=updated.jugador_negras_id,
                status="cancelled",
                message="Invitation cancelled" if is_host else "Invitation declined"
            ),
            "broadcast_payload": broadcast_payload
        }

    def _map_to_response(self, match: Match) -> MatchResponse:
        user_w = self.user_repo.find_by_id(match.jugador_blancas_id)
        user_b = self.user_repo.find_by_id(match.jugador_negras_id)
        
        t_w = match.tiempo_restante_blancas
        t_b = match.tiempo_restante_negras
        
        if match.estado == MatchStatus.IN_PROGRESS and match.ultima_jugada_en:
            now = datetime.now(timezone.utc)
            last_move_time = match.ultima_jugada_en.replace(tzinfo=timezone.utc) if match.ultima_jugada_en.tzinfo is None else match.ultima_jugada_en
            elapsed = (now - last_move_time).total_seconds()
            
            # Reconstruct turn
            board = chess.Board()
            for mv in (match.movimientos_pgn or "").split():
                try:
                    board.push_san(mv)
                except ValueError:
                    try:
                        board.push_uci(mv)
                    except ValueError:
                        pass
            
            if board.turn == chess.WHITE:
                if t_w is not None:
                    t_w = max(0.0, t_w - elapsed)
            else:
                if t_b is not None:
                    t_b = max(0.0, t_b - elapsed)
                    
        return MatchResponse(
            id=match.id,
            jugador_blancas_id=match.jugador_blancas_id,
            jugador_negras_id=match.jugador_negras_id,
            playerWhiteUsername=user_w.nombre_usuario if user_w else "Unknown",
            playerBlackUsername=user_b.nombre_usuario if user_b else "Unknown",
            modo=match.modo,
            control_tiempo=match.control_tiempo,
            resultado=match.resultado,
            estado=match.estado,
            movimientos_pgn=match.movimientos_pgn,
            creada_en=match.creada_en,
            finalizada_en=match.finalizada_en,
            tiempo_restante_blancas=t_w,
            tiempo_restante_negras=t_b,
            ultima_jugada_en=match.ultima_jugada_en
        )


    def make_move(self, match_id: int, user_id: int, request: MoveRequest) -> dict:
        match = self.match_repo.find_by_id(match_id)
        if not match or match.estado != MatchStatus.IN_PROGRESS:
            raise HTTPException(status_code=400, detail="Match is not active")
        
        # Determine player color
        if user_id == match.jugador_blancas_id:
            color = "white"
        elif user_id == match.jugador_negras_id:
            color = "black"
        else:
            raise HTTPException(status_code=403, detail="You are not a participant in this match")
            
        # Reconstruct the board from PGN moves
        board = chess.Board()
        for mv in (match.movimientos_pgn or "").split():
            try:
                board.push_san(mv)
            except ValueError:
                try:
                    board.push_uci(mv)
                except ValueError:
                    pass

        # Calculate time elapsed and update active player clock
        now = datetime.now(timezone.utc)
        elapsed = 0.0
        if match.ultima_jugada_en:
            last_move_time = match.ultima_jugada_en.replace(tzinfo=timezone.utc) if match.ultima_jugada_en.tzinfo is None else match.ultima_jugada_en
            elapsed = (now - last_move_time).total_seconds()
            
        _, increment = self._parse_control_tiempo(match.control_tiempo)
        
        new_elo_w = None
        new_elo_b = None
        change_w = 0
        change_b = 0
        
        if color == "white":
            if match.tiempo_restante_blancas is not None:
                match.tiempo_restante_blancas = max(0.0, match.tiempo_restante_blancas - elapsed)
                if match.tiempo_restante_blancas <= 0.0:
                    match.tiempo_restante_blancas = 0.0
                    match.estado = MatchStatus.FINISHED
                    match.resultado = MatchResult.BLACK_WIN
                    match.ganador_id = match.jugador_negras_id
                    match.finalizada_en = now
                    new_elo_w, new_elo_b, change_w, change_b = self._finalize_match_ratings_and_stats(match, match.resultado)
                    self.match_repo.update(match)
                    raise HTTPException(status_code=400, detail="White lost on time")
                match.tiempo_restante_blancas += increment
        else:
            if match.tiempo_restante_negras is not None:
                match.tiempo_restante_negras = max(0.0, match.tiempo_restante_negras - elapsed)
                if match.tiempo_restante_negras <= 0.0:
                    match.tiempo_restante_negras = 0.0
                    match.estado = MatchStatus.FINISHED
                    match.resultado = MatchResult.WHITE_WIN
                    match.ganador_id = match.jugador_blancas_id
                    match.finalizada_en = now
                    new_elo_w, new_elo_b, change_w, change_b = self._finalize_match_ratings_and_stats(match, match.resultado)
                    self.match_repo.update(match)
                    raise HTTPException(status_code=400, detail="Black lost on time")
                match.tiempo_restante_negras += increment

        match.ultima_jugada_en = now
                    
        # Validate and apply move
        result = ChessEngine.validate_move(board.fen(), request.move, color)
        if not result["isValid"]:
            raise HTTPException(status_code=400, detail=result["rejectionReason"])
            
        san_move = result["appliedMove"]
        new_pgn = f"{match.movimientos_pgn or ''} {san_move}".strip()
        match.movimientos_pgn = new_pgn
        
        # Detect status
        status = ChessEngine.detect_status(result["newBoardState"])

        end_reason = None
        if status["isCheckmate"]:
            match.estado = MatchStatus.FINISHED
            match.finalizada_en = datetime.now(timezone.utc)
            end_reason = "checkmate"
            if color == "white":
                match.resultado = MatchResult.WHITE_WIN
                match.ganador_id = match.jugador_blancas_id
            else:
                match.resultado = MatchResult.BLACK_WIN
                match.ganador_id = match.jugador_negras_id
            new_elo_w, new_elo_b, change_w, change_b = self._finalize_match_ratings_and_stats(match, match.resultado)
        elif status["isDraw"]:
            match.estado = MatchStatus.FINISHED
            match.finalizada_en = datetime.now(timezone.utc)
            match.resultado = MatchResult.DRAW
            end_reason = "stalemate" if status.get("isStalemate") else "draw"
            new_elo_w, new_elo_b, change_w, change_b = self._finalize_match_ratings_and_stats(match, match.resultado)
            
        self.match_repo.update(match)
        
        # Prepare broadcast payload
        fen_parts = result["newBoardState"].split()
        next_turn = "white" if len(fen_parts) > 1 and fen_parts[1] == "w" else "black"
        
        broadcast_payload = {
            "type": "move_made",
            "move": san_move,
            "board_state": result["newBoardState"],
            "is_checkmate": status["isCheckmate"],
            "is_draw": status["isDraw"],
            "end_reason": end_reason,
            "turn": next_turn,
            "match_status": match.estado.value if hasattr(match.estado, "value") else match.estado,
            "winner_id": match.ganador_id,
            "resultado": match.resultado.value if hasattr(match.resultado, "value") else match.resultado,
            "movimientos_pgn": match.movimientos_pgn,
            "newELOPlayerWhite": new_elo_w,
            "newELOPlayerBlack": new_elo_b,
            "eloChangePlayerWhite": change_w,
            "eloChangePlayerBlack": change_b,
            "tiempo_restante_blancas": match.tiempo_restante_blancas,
            "tiempo_restante_negras": match.tiempo_restante_negras,
            "ultima_jugada_en": match.ultima_jugada_en.isoformat() if match.ultima_jugada_en else None
        }
        
        return {
            "response": MoveResponse(
                success=True,
                move=san_move,
                board_state=result["newBoardState"],
                is_checkmate=status["isCheckmate"],
                is_draw=status["isDraw"]
            ),
            "broadcast_payload": broadcast_payload
        }

    def get_pending_invites(self, user_id: int) -> List[dict]:
        invites = self.match_repo.find_pending_invites_by_guest_id(user_id)
        results = []
        for inv in invites:
            host = self.user_repo.find_by_id(inv.jugador_blancas_id)
            host_rating = self.rating_repo.find_by_usuario_and_modo(inv.jugador_blancas_id, inv.modo)
            results.append({
                "id": inv.id,
                "inviter_id": inv.jugador_blancas_id,
                "inviter_username": host.nombre_usuario if host else "Unknown",
                "inviter_elo": host_rating.rating if host_rating else 1200,
                "modo": inv.modo,
                "control_tiempo": inv.control_tiempo,
                "estado": inv.estado
            })
        return results

    def get_sent_invites(self, user_id: int) -> List[dict]:
        invites = self.match_repo.find_pending_invites_by_host_id(user_id)
        results = []
        for inv in invites:
            guest = self.user_repo.find_by_id(inv.jugador_negras_id)
            guest_rating = self.rating_repo.find_by_usuario_and_modo(inv.jugador_negras_id, inv.modo)
            results.append({
                "id": inv.id,
                "invited_id": inv.jugador_negras_id,
                "invited_username": guest.nombre_usuario if guest else "Unknown",
                "invited_elo": guest_rating.rating if guest_rating else 1200,
                "modo": inv.modo,
                "control_tiempo": inv.control_tiempo,
                "estado": inv.estado
            })
        return results

    def get_active_matches_for_player(self, user_id: int) -> List[dict]:
        from ..models.enums import MatchStatus
        matches = self.match_repo.find_by_player_id(user_id)
        results = []
        for m in matches:
            if m.estado == MatchStatus.IN_PROGRESS:
                is_white = m.jugador_blancas_id == user_id
                opponent_id = m.jugador_negras_id if is_white else m.jugador_blancas_id
                opponent = self.user_repo.find_by_id(opponent_id)
                
                # Determine active turn by checking the moves count in PGN
                moves = (m.movimientos_pgn or "").split()
                active_color = "white" if len(moves) % 2 == 0 else "black"
                is_my_turn = (active_color == "white" and is_white) or (active_color == "black" and not is_white)
                
                results.append({
                    "id": m.id,
                    "opponent_username": opponent.nombre_usuario if opponent else "Unknown",
                    "modo": m.modo,
                    "control_tiempo": m.control_tiempo,
                    "player_color": "white" if is_white else "black",
                    "estado": m.estado,
                    "active_turn": active_color,
                    "is_my_turn": is_my_turn
                })
        return results

    def _parse_control_tiempo(self, control: str) -> tuple[int, int]:
        try:
            parts = control.split("+")
            base = int(parts[0])
            increment = int(parts[1]) if len(parts) > 1 else 0
            # Legacy compatibility:
            # Some old clients stored seconds in the base part (e.g. "300+0" for 5+0).
            # If base is unusually large for minutes, treat it as seconds.
            if base >= 180:
                return base, increment
            return base * 60, increment
        except Exception:
            return 600, 0

    def check_and_apply_timeout(self, match_id: int) -> Optional[dict]:
        match = self.match_repo.find_by_id(match_id)
        if not match or match.estado != MatchStatus.IN_PROGRESS:
            return None
            
        now = datetime.now(timezone.utc)
        elapsed = 0.0
        if match.ultima_jugada_en:
            last_move_time = match.ultima_jugada_en.replace(tzinfo=timezone.utc) if match.ultima_jugada_en.tzinfo is None else match.ultima_jugada_en
            elapsed = (now - last_move_time).total_seconds()
            
        # Reconstruct turn
        board = chess.Board()
        for mv in (match.movimientos_pgn or "").split():
            try:
                board.push_san(mv)
            except ValueError:
                try:
                    board.push_uci(mv)
                except ValueError:
                    pass
                    
        is_white_turn = board.turn == chess.WHITE
        
        timed_out = False
        result = None
        winner_id = None
        
        if is_white_turn:
            if match.tiempo_restante_blancas is not None:
                remaining = match.tiempo_restante_blancas - elapsed
                if remaining <= 0.0:
                    match.tiempo_restante_blancas = 0.0
                    match.estado = MatchStatus.FINISHED
                    match.resultado = MatchResult.BLACK_WIN
                    match.ganador_id = match.jugador_negras_id
                    match.finalizada_en = now
                    timed_out = True
                    result = MatchResult.BLACK_WIN
                    winner_id = match.jugador_negras_id
        else:
            if match.tiempo_restante_negras is not None:
                remaining = match.tiempo_restante_negras - elapsed
                if remaining <= 0.0:
                    match.tiempo_restante_negras = 0.0
                    match.estado = MatchStatus.FINISHED
                    match.resultado = MatchResult.WHITE_WIN
                    match.ganador_id = match.jugador_blancas_id
                    match.finalizada_en = now
                    timed_out = True
                    result = MatchResult.WHITE_WIN
                    winner_id = match.jugador_blancas_id
                    
        if timed_out:
            new_rw, new_rb, change_w, change_b = self._finalize_match_ratings_and_stats(match, result)
            self.match_repo.update(match)
            return {
                "type": "match_ended",
                "reason": "timeout",
                "end_reason": "timeout",
                "winner_id": winner_id,
                "resultado": result.value if hasattr(result, "value") else result,
                "newELOPlayerWhite": new_rw,
                "newELOPlayerBlack": new_rb,
                "eloChangePlayerWhite": change_w,
                "eloChangePlayerBlack": change_b
            }
            
        return None

