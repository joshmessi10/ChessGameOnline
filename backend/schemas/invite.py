from typing import Optional
from pydantic import BaseModel
from ..models.enums import MatchType

class InviteRequest(BaseModel):
    friend_id: int
    modo: MatchType
    control_tiempo: str

class InviteResponse(BaseModel):
    id: int
    inviter_id: int
    invited_id: int
    status: str
    message: str
