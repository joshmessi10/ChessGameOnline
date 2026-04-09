from fastapi import APIRouter, Depends, Query
from ..schemas.user import UserSearchResponse
from ..services.user_service import UserService
from ..core.dependencies import SessionDep

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/search", response_model=UserSearchResponse)
async def search_users(q: str = Query(..., min_length=1), session: SessionDep = None):
    service = UserService(session)
    return service.search_users(q)
