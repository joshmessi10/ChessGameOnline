from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from .enums import MatchType, MatchStatus, MatchResult

if TYPE_CHECKING:
    from .usuario import Usuario

class Match(SQLModel, table=True):
    __tablename__ = "partidas"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    jugador_blancas_id: int = Field(foreign_key="usuarios.id", nullable=False)
    jugador_negras_id: int = Field(foreign_key="usuarios.id", nullable=False)
    modo: MatchType = Field(nullable=False)
    control_tiempo: str = Field(nullable=False) # e.g., "10+5"
    ganador_id: Optional[int] = Field(default=None, foreign_key="usuarios.id")
    resultado: MatchResult = Field(default=MatchResult.ONGOING)
    estado: MatchStatus = Field(default=MatchStatus.WAITING)
    movimientos_pgn: Optional[str] = Field(default=None) # TEXT in diagram
    creada_en: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    finalizada_en: Optional[datetime] = None

    # Relationships
    jugador_blancas: "Usuario" = Relationship(
        back_populates="partidas_blancas",
        sa_relationship_kwargs={"primaryjoin": "Match.jugador_blancas_id == Usuario.id"}
    )
    jugador_negras: "Usuario" = Relationship(
        back_populates="partidas_negras",
        sa_relationship_kwargs={"primaryjoin": "Match.jugador_negras_id == Usuario.id"}
    )
