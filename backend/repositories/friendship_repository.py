from typing import Optional, List
from sqlmodel import Session, select, or_, and_
from ..models.friendship import Friendship
from ..models.enums import FriendshipStatus

class FriendshipRepository:
    def __init__(self, session: Session):
        self.session = session

    def find_by_usuario_id(self, usuario_id: int) -> List[Friendship]:
        statement = select(Friendship).where(
            or_(Friendship.usuario_id == usuario_id, Friendship.amigo_id == usuario_id)
        )
        return self.session.exec(statement).all()

    def find_relation(self, user_a_id: int, user_b_id: int) -> Optional[Friendship]:
        statement = select(Friendship).where(
            or_(
                and_(Friendship.usuario_id == user_a_id, Friendship.amigo_id == user_b_id),
                and_(Friendship.usuario_id == user_b_id, Friendship.amigo_id == user_a_id)
            )
        )
        return self.session.exec(statement).first()

    def save(self, friendship: Friendship) -> Friendship:
        self.session.add(friendship)
        self.session.commit()
        self.session.refresh(friendship)
        return friendship

    def update(self, friendship: Friendship) -> Friendship:
        self.session.add(friendship)
        self.session.commit()
        self.session.refresh(friendship)
        return friendship

    def delete(self, friendship: Friendship) -> None:
        self.session.delete(friendship)
        self.session.commit()
