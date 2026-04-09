from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from .usuario import Usuario

class Statistics(SQLModel, table=True):
    __tablename__ = "estadisticas"
    
    usuario_id: int = Field(primary_key=True, foreign_key="usuarios.id")
    partidas_jugadas: int = Field(default=0)
    victorias: int = Field(default=0)
    derrotas: int = Field(default=0)
    empates: int = Field(default=0)
    actualizado_en: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationship
    usuario: "Usuario" = Relationship(back_populates="estadisticas")
