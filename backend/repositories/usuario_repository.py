from typing import Optional, List
from sqlmodel import Session, select
from ..models.usuario import Usuario

class UsuarioRepository:
    def __init__(self, session: Session):
        self.session = session

    def find_by_id(self, usuario_id: int) -> Optional[Usuario]:
        return self.session.get(Usuario, usuario_id)

    def find_by_email(self, email: str) -> Optional[Usuario]:
        statement = select(Usuario).where(Usuario.correo == email)
        return self.session.exec(statement).first()

    def find_by_username(self, username: str) -> Optional[Usuario]:
        statement = select(Usuario).where(Usuario.nombre_usuario == username)
        return self.session.exec(statement).first()

    def search_users(self, query: str) -> List[Usuario]:
        statement = select(Usuario).where(Usuario.nombre_usuario.contains(query))
        return self.session.exec(statement).all()

    def save(self, user: Usuario) -> Usuario:
        self.session.add(user)
        self.session.commit()
        self.session.refresh(user)
        return user

    def update(self, user: Usuario) -> Usuario:
        self.session.add(user)
        self.session.commit()
        self.session.refresh(user)
        return user
