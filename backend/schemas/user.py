from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from ..models.enums import MatchType

class StatsDTO(BaseModel):
    partidas_jugadas: int
    victorias: int
    derrotas: int
    empates: int
    actualizado_en: datetime

class UserResult(BaseModel):
    id: int
    nombre_usuario: str
    url_avatar: Optional[str]
    pais: Optional[str]
    userELO: Optional[int] = 1200

class FriendListItemDTO(BaseModel):
    friendID: int
    username: str
    userELO: int

class MatchHistoryItemDTO(BaseModel):
    matchID: int
    opponentUsername: str
    result: str
    date: datetime
    playerColor: str
    modo: MatchType


class UserResponse(BaseModel):
    id: int
    nombre_usuario: str
    correo: str
    url_avatar: Optional[str]
    pais: Optional[str]
    creado_en: datetime
    userELO: int = 1200
    bulletELO: int = 1200
    blitzELO: int = 1200
    rapidELO: int = 1200
    classicalELO: int = 1200
    stats: Optional[StatsDTO]
    friendList: List[FriendListItemDTO] = []
    matchHistory: List[MatchHistoryItemDTO] = []


class UserSearchResponse(BaseModel):
    results: List[UserResult]

class SettingsDTO(BaseModel):
    nombre_usuario: str
    correo: str
    url_avatar: Optional[str]
    pais: Optional[str]
