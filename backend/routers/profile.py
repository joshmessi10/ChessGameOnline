from fastapi import APIRouter, Depends
from typing import Optional
from ..schemas.user import UserResponse
from ..services.user_service import UserService
from ..core.dependencies import SessionDep, CurrentUserDep
from ..models.enums import MatchType

router = APIRouter(prefix="/api/profile", tags=["profile"])

# IMPORTANT: /me must be declared BEFORE /{userID} so FastAPI
# doesn't try to cast the string "me" as an integer path param.
@router.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: CurrentUserDep, session: SessionDep, modo: Optional[MatchType] = None):
    service = UserService(session)
    return service.get_profile(current_user.id, modo)

@router.get("/{userID}", response_model=UserResponse)
async def get_profile(userID: int, session: SessionDep, modo: Optional[MatchType] = None):
    service = UserService(session)
    return service.get_profile(userID, modo)

