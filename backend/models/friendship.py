from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from .enums import FriendshipStatus

if TYPE_CHECKING:
    from .usuario import Usuario

class Friendship(SQLModel, table=True):
    __tablename__ = "amigos"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="usuarios.id", nullable=False)
    amigo_id: int = Field(foreign_key="usuarios.id", nullable=False)
    estado: FriendshipStatus = Field(default=FriendshipStatus.PENDING)
    creado_en: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationships
    usuario: "Usuario" = Relationship(
        back_populates="amigos_enviados", 
        sa_relationship_kwargs={"primaryjoin": "Friendship.usuario_id == Usuario.id"}
    )
    amigo: "Usuario" = Relationship(
        back_populates="amigos_recibidos", 
        sa_relationship_kwargs={"primaryjoin": "Friendship.amigo_id == Usuario.id"}
    )
