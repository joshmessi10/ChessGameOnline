from typing import Optional, List
from sqlmodel import Session, select
from ..models.rating import Rating
from ..models.enums import MatchType

class RatingRepository:
    def __init__(self, session: Session):
        self.session = session

    def find_by_usuario_id(self, usuario_id: int) -> List[Rating]:
        statement = select(Rating).where(Rating.usuario_id == usuario_id)
        return self.session.exec(statement).all()

    def find_by_usuario_and_modo(self, usuario_id: int, modo: MatchType) -> Optional[Rating]:
        statement = select(Rating).where(
            Rating.usuario_id == usuario_id,
            Rating.modo == modo
        )
        return self.session.exec(statement).first()

    def save(self, rating: Rating) -> Rating:
        self.session.add(rating)
        self.session.commit()
        self.session.refresh(rating)
        return rating

    def update(self, rating: Rating) -> Rating:
        self.session.add(rating)
        self.session.commit()
        self.session.refresh(rating)
        return rating
