from fastapi import APIRouter, Depends, status
from ..schemas.auth import RegisterRequest, RegisterResponse, LoginRequest, LoginResponse, LogoutResponse
from ..services.auth_service import AuthService
from ..core.dependencies import SessionDep

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, session: SessionDep):
    service = AuthService(session)
    user = service.register(request)
    return RegisterResponse(
        id=user.id,
        nombre_usuario=user.nombre_usuario,
        correo=user.correo
    )

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, session: SessionDep):
    service = AuthService(session)
    return service.login(request)

@router.post("/logout", response_model=LogoutResponse)
async def logout():
    return LogoutResponse()
