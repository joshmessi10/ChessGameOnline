from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from ..models.enums import MatchType, MatchStatus, MatchResult

class MoveRequest(BaseModel):
    move: str # Standard algebraic notation or UCI

class MoveResponse(BaseModel):
    success: bool
    move: str
    board_state: str # FEN
    is_checkmate: bool
    is_draw: bool

class MatchStatusDTO(BaseModel):
    match_id: int
    estado: MatchStatus
    resultado: MatchResult
    last_move: Optional[str]

class MatchResponse(BaseModel):
    id: int
    jugador_blancas_id: int
    jugador_negras_id: int
    modo: MatchType
    control_tiempo: str
    resultado: MatchResult
    estado: MatchStatus
    movimientos_pgn: Optional[str]
    creada_en: datetime
    finalizada_en: Optional[datetime]

class EndMatchRequest(BaseModel):
    reason: str

class EndMatchResponse(BaseModel):
    match_id: int
    result: MatchResult
    final_pgn: str
    newELOPlayerWhite: int
    newELOPlayerBlack: int
