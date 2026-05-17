from typing import Optional, List
from sqlmodel import Session, select, or_
from ..models.match import Match

class MatchRepository:
    def __init__(self, session: Session):
        self.session = session

    def find_by_id(self, match_id: int) -> Optional[Match]:
        return self.session.get(Match, match_id)

    def find_by_player_id(self, player_id: int) -> List[Match]:
        statement = select(Match).where(
            or_(Match.jugador_blancas_id == player_id, Match.jugador_negras_id == player_id)
        )
        return self.session.exec(statement).all()

    def save(self, match: Match) -> Match:
        self.session.add(match)
        self.session.commit()
        self.session.refresh(match)
        return match

    def update(self, match: Match) -> Match:
        self.session.add(match)
        self.session.commit()
        self.session.refresh(match)
        return match
        
    def get_active_matches(self) -> List[Match]:
        statement = select(Match).where(Match.estado == "in_progress")
        return self.session.exec(statement).all()
        
    def get_finished_matches(self) -> List[Match]:
        statement = select(Match).where(Match.estado == "finished")
        return self.session.exec(statement).all()

    def find_pending_invites_by_guest_id(self, guest_id: int) -> List[Match]:
        from ..models.enums import MatchStatus
        statement = select(Match).where(
            Match.jugador_negras_id == guest_id,
            Match.estado == MatchStatus.WAITING
        )
        return self.session.exec(statement).all()

