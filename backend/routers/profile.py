from fastapi import APIRouter, Depends
from ..schemas.user import UserResponse
from ..services.user_service import UserService
from ..core.dependencies import SessionDep, CurrentUserDep

router = APIRouter(prefix="/api/profile", tags=["profile"])

# IMPORTANT: /me must be declared BEFORE /{userID} so FastAPI
# doesn't try to cast the string "me" as an integer path param.
@router.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: CurrentUserDep, session: SessionDep):
    service = UserService(session)
    return service.get_profile(current_user.id)

@router.get("/{userID}", response_model=UserResponse)
async def get_profile(userID: int, session: SessionDep):
    service = UserService(session)
    return service.get_profile(userID)
