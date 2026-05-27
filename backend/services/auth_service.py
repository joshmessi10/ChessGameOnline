from fastapi import HTTPException, status
from sqlmodel import Session
from ..repositories.usuario_repository import UsuarioRepository
from ..models.usuario import Usuario
from ..schemas.auth import RegisterRequest, LoginRequest, LoginResponse
from ..core.security import get_password_hash, verify_password, create_access_token

class AuthService:
    def __init__(self, session: Session):
        self.repo = UsuarioRepository(session)

    def register(self, request: RegisterRequest) -> Usuario:
        # Check if user already exists
        if self.repo.find_by_username(request.nombre_usuario):
            raise HTTPException(status_code=400, detail="Username already registered")
        if self.repo.find_by_email(request.correo):
            raise HTTPException(status_code=400, detail="Email already registered")
            
        hashed_password = get_password_hash(request.hash_contrasena)
        new_user = Usuario(
            nombre_usuario=request.nombre_usuario,
            correo=request.correo,
            hash_contrasena=hashed_password,
            pais=request.pais
        )
        return self.repo.save(new_user)

    def login(self, request: LoginRequest) -> LoginResponse:
        user = self.repo.find_by_username(request.username)
        if not user:
            user = self.repo.find_by_email(request.username)
            
        if not user or not verify_password(request.password, user.hash_contrasena):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        access_token = create_access_token(data={"sub": str(user.id)})
        return LoginResponse(access_token=access_token)
