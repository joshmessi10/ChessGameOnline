from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from .rating import Rating
    from .friendship import Friendship
    from .match import Match
    from .statistics import Statistics

class Usuario(SQLModel, table=True):
    __tablename__ = "usuarios"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre_usuario: str = Field(index=True, unique=True, nullable=False)
    correo: str = Field(index=True, unique=True, nullable=False)
    hash_contrasena: str = Field(nullable=False)
    url_avatar: Optional[str] = None
    pais: Optional[str] = None
    creado_en: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ultimo_login: Optional[datetime] = None

    # Relationships
    ratings: List["Rating"] = Relationship(back_populates="usuario")
    estadisticas: Optional["Statistics"] = Relationship(back_populates="usuario")
    
    # Friendships (as sender and receiver)
    amigos_enviados: List["Friendship"] = Relationship(
        back_populates="usuario", 
        sa_relationship_kwargs={"primaryjoin": "Usuario.id == Friendship.usuario_id"}
    )
    amigos_recibidos: List["Friendship"] = Relationship(
        back_populates="amigo", 
        sa_relationship_kwargs={"primaryjoin": "Usuario.id == Friendship.amigo_id"}
    )
    
    # Matches (as white or black)
    partidas_blancas: List["Match"] = Relationship(
        back_populates="jugador_blancas",
        sa_relationship_kwargs={"primaryjoin": "Usuario.id == Match.jugador_blancas_id"}
    )
    partidas_negras: List["Match"] = Relationship(
        back_populates="jugador_negras",
        sa_relationship_kwargs={"primaryjoin": "Usuario.id == Match.jugador_negras_id"}
    )
