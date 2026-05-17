from datetime import datetime, timezone
import math
from typing import Optional, List
from fastapi import HTTPException
from sqlmodel import Session
from ..repositories.match_repository import MatchRepository
from ..repositories.rating_repository import RatingRepository
from ..repositories.statistics_repository import StatisticsRepository
from ..models.match import Match
from ..models.enums import MatchStatus, MatchResult, EndReason
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


    def get_match(self, match_id: int) -> MatchResponse:
        match = self.match_repo.find_by_id(match_id)
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")
        return self._map_to_response(match)

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
        
        return int(new_rw), int(new_rb), int(new_rw) - rw, int(new_rb) - rb


    def end_match(self, match_id: int, user_id: int, request: EndMatchRequest) -> EndMatchResponse:
        match = self.match_repo.find_by_id(match_id)
        if not match or match.estado != MatchStatus.IN_PROGRESS:
            raise HTTPException(status_code=400, detail="Match not active")
            
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
        
        return EndMatchResponse(
            match_id=match.id,
            result=match.resultado,
            final_pgn=match.movimientos_pgn or "",
            newELOPlayerWhite=new_rw,
            newELOPlayerBlack=new_rb,
            eloChangePlayerWhite=change_w,
            eloChangePlayerBlack=change_b
        )


    def send_invite(self, host_id: int, request: InviteRequest) -> InviteResponse:
        # Mocking invite creation (could be a table, but for now we create a WAITING match)
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

    def join_match(self, match_id: int, user_id: int) -> InviteResponse:
        match = self.match_repo.find_by_id(match_id)
        if not match:
            raise HTTPException(status_code=404, detail="Invitation match not found")
        if match.estado != MatchStatus.WAITING:
            raise HTTPException(status_code=400, detail="Match is already in progress, finished, or cancelled")
        if match.jugador_negras_id != user_id:
            raise HTTPException(status_code=403, detail="You are not the guest of this invitation")

        match.estado = MatchStatus.IN_PROGRESS
        updated = self.match_repo.update(match)

        return InviteResponse(
            id=updated.id,
            inviter_id=updated.jugador_blancas_id,
            invited_id=updated.jugador_negras_id,
            status="accepted",
            message="Invitation accepted, match started!"
        )

    def decline_invite(self, match_id: int, user_id: int) -> InviteResponse:
        match = self.match_repo.find_by_id(match_id)
        if not match:
            raise HTTPException(status_code=404, detail="Invitation match not found")
        if match.estado != MatchStatus.WAITING:
            raise HTTPException(status_code=400, detail="Match is already in progress, finished, or cancelled")
        if match.jugador_negras_id != user_id:
            raise HTTPException(status_code=403, detail="You are not the guest of this invitation")

        match.estado = MatchStatus.CANCELLED
        updated = self.match_repo.update(match)

        return InviteResponse(
            id=updated.id,
            inviter_id=updated.jugador_blancas_id,
            invited_id=updated.jugador_negras_id,
            status="cancelled",
            message="Invitation declined"
        )

    def _map_to_response(self, match: Match) -> MatchResponse:
        user_w = self.user_repo.find_by_id(match.jugador_blancas_id)
        user_b = self.user_repo.find_by_id(match.jugador_negras_id)
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
            finalizada_en=match.finalizada_en
        )


    def make_move(self, match_id: int, user_id: int, request: MoveRequest) -> MoveResponse:
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
                    
        # Validate and apply move
        result = ChessEngine.validate_move(board.fen(), request.move, color)
        if not result["isValid"]:
            raise HTTPException(status_code=400, detail=result["rejectionReason"])
            
        san_move = result["appliedMove"]
        new_pgn = f"{match.movimientos_pgn or ''} {san_move}".strip()
        match.movimientos_pgn = new_pgn
        
        # Detect status
        status = ChessEngine.detect_status(result["newBoardState"])
        
        if status["isCheckmate"]:
            match.estado = MatchStatus.FINISHED
            match.finalizada_en = datetime.now(timezone.utc)
            if color == "white":
                match.resultado = MatchResult.WHITE_WIN
                match.ganador_id = match.jugador_blancas_id
            else:
                match.resultado = MatchResult.BLACK_WIN
                match.ganador_id = match.jugador_negras_id
            self._finalize_match_ratings_and_stats(match, match.resultado)
        elif status["isDraw"]:
            match.estado = MatchStatus.FINISHED
            match.finalizada_en = datetime.now(timezone.utc)
            match.resultado = MatchResult.DRAW
            self._finalize_match_ratings_and_stats(match, match.resultado)
            
        self.match_repo.update(match)
        
        return MoveResponse(
            success=True,
            move=san_move,
            board_state=result["newBoardState"],
            is_checkmate=status["isCheckmate"],
            is_draw=status["isDraw"]
        )

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

