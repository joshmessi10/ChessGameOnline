from typing import Optional
from pydantic import BaseModel
from ..models.enums import MatchType

class TimeConfigDTO(BaseModel):
    base_time_minutes: int
    increment_seconds: int

class QueueRequest(BaseModel):
    modo: MatchType
    prefered_time: Optional[TimeConfigDTO] = None

class QueueResponse(BaseModel):
    status: str
    message: str
    estimated_wait_time: int # in seconds

class MatchNotification(BaseModel):
    match_id: int
    opponent_id: int
    opponent_name: str
    color: str # "white" or "black"
