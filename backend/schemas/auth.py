from typing import Optional
from pydantic import BaseModel, EmailStr

class RegisterRequest(BaseModel):
    nombre_usuario: str
    correo: EmailStr
    hash_contrasena: str
    pais: Optional[str] = None

class RegisterResponse(BaseModel):
    id: int
    nombre_usuario: str
    correo: str
    message: str = "User registered successfully"

class LoginRequest(BaseModel):
    username: str # Can be username or email depending on implementation
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class LogoutResponse(BaseModel):
    message: str = "Logged out successfully"
