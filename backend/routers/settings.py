from fastapi import APIRouter, Depends
from ..schemas.user import SettingsDTO, UserResponse
from ..services.user_service import UserService
from ..core.dependencies import SessionDep, CurrentUserDep

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("/{userID}", response_model=SettingsDTO)
async def get_settings(userID: int, session: SessionDep, current_user: CurrentUserDep):
    # Only allowed for the owner
    if current_user.id != userID:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Forbidden")
        
    service = UserService(session)
    profile = service.get_profile(userID)
    return SettingsDTO(
        nombre_usuario=profile.nombre_usuario,
        correo=profile.correo,
        url_avatar=profile.url_avatar,
        pais=profile.pais
    )

@router.put("/{userID}", response_model=UserResponse)
async def update_settings(userID: int, request: SettingsDTO, session: SessionDep, current_user: CurrentUserDep):
    if current_user.id != userID:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Forbidden")
        
    service = UserService(session)
    return service.update_settings(userID, request)
