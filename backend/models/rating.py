from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from .enums import MatchType

if TYPE_CHECKING:
    from .usuario import Usuario

class Rating(SQLModel, table=True):
    __tablename__ = "ratings"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="usuarios.id", nullable=False)
    modo: MatchType = Field(nullable=False)
    rating: int = Field(default=1200)
    actualizado_en: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationship
    usuario: "Usuario" = Relationship(back_populates="ratings")
