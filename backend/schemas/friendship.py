from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from ..models.enums import FriendshipStatus

class FriendRequest(BaseModel):
    target_id: int

class FriendResponse(BaseModel):
    id: int
    usuario_id: int
    amigo_id: int
    estado: FriendshipStatus
    creado_en: datetime

class FriendshipDTO(BaseModel):
    id: int
    usuario_id: int
    amigo_id: int
    amigo_name: str
    estado: FriendshipStatus
    url_avatar: Optional[str] = None
