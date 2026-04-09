from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlmodel import Session
from ..database import get_session
from ..config import settings
from ..models.usuario import Usuario
from ..repositories.usuario_repository import UsuarioRepository

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

SessionDep = Annotated[Session, Depends(get_session)]

async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], session: SessionDep) -> Usuario:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    repo = UsuarioRepository(session)
    user = repo.find_by_username(username)
    if user is None:
        raise credentials_exception
    return user

CurrentUserDep = Annotated[Usuario, Depends(get_current_user)]
