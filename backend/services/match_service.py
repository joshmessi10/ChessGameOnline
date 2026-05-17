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
        self.match_repo = MatchRepository(session)
        self.rating_repo = RatingRepository(session)
        self.stats_repo = StatisticsRepository(session)

    def get_match(self, match_id: int) -> MatchResponse:
        match = self.match_repo.find_by_id(match_id)
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")
        return self._map_to_response(match)

    def end_match(self, match_id: int, user_id: int, request: EndMatchRequest) -> EndMatchResponse:
        match = self.match_repo.find_by_id(match_id)
        if not match or match.estado != MatchStatus.IN_PROGRESS:
            raise HTTPException(status_code=400, detail="Match not active")
            
        # Basic ELO Logic (simplified)
        k = 32
        white_rating = self.rating_repo.find_by_usuario_and_modo(match.jugador_blancas_id, match.modo)
        black_rating = self.rating_repo.find_by_usuario_and_modo(match.jugador_negras_id, match.modo)
        
        rw = white_rating.rating if white_rating else 1200
        rb = black_rating.rating if black_rating else 1200
        
        ew = 1 / (1 + 10 ** ((rb - rw) / 400))
        eb = 1 / (1 + 10 ** ((rw - rb) / 400))
        
        # Determine actual scores
        sw, sb = 0.5, 0.5
        if request.reason == "victory":
            if user_id == match.jugador_blancas_id:
                sw, sb = 1, 0
                match.resultado = MatchResult.WHITE_WIN
                match.ganador_id = match.jugador_blancas_id
            else:
                sw, sb = 0, 1
                match.resultado = MatchResult.BLACK_WIN
                match.ganador_id = match.jugador_negras_id
        
        new_rw = rw + k * (sw - ew)
        new_rb = rb + k * (sb - eb)
        
        # Update ratings
        if white_rating:
            white_rating.rating = int(new_rw)
            self.rating_repo.update(white_rating)
        if black_rating:
            black_rating.rating = int(new_rb)
            self.rating_repo.update(black_rating)
            
        match.estado = MatchStatus.FINISHED
        match.finalizada_en = datetime.now(timezone.utc)
        self.match_repo.update(match)
        
        return EndMatchResponse(
            match_id=match.id,
            result=match.resultado,
            final_pgn=match.movimientos_pgn or "",
            newELOPlayerWhite=int(new_rw),
            newELOPlayerBlack=int(new_rb)
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

    def _map_to_response(self, match: Match) -> MatchResponse:
        return MatchResponse(
            id=match.id,
            jugador_blancas_id=match.jugador_blancas_id,
            jugador_negras_id=match.jugador_negras_id,
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
        elif status["isDraw"]:
            match.estado = MatchStatus.FINISHED
            match.finalizada_en = datetime.now(timezone.utc)
            match.resultado = MatchResult.DRAW
            
        self.match_repo.update(match)
        
        return MoveResponse(
            success=True,
            move=san_move,
            board_state=result["newBoardState"],
            is_checkmate=status["isCheckmate"],
            is_draw=status["isDraw"]
        )
