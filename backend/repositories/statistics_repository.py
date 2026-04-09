from typing import Optional
from sqlmodel import Session, select
from ..models.statistics import Statistics

class StatisticsRepository:
    def __init__(self, session: Session):
        self.session = session

    def find_by_usuario_id(self, usuario_id: int) -> Optional[Statistics]:
        statement = select(Statistics).where(Statistics.usuario_id == usuario_id)
        return self.session.exec(statement).first()

    def save(self, stats: Statistics) -> Statistics:
        self.session.add(stats)
        self.session.commit()
        self.session.refresh(stats)
        return stats

    def update(self, stats: Statistics) -> Statistics:
        # Since stats are usually updated in place
        self.session.add(stats)
        self.session.commit()
        self.session.refresh(stats)
        return stats
