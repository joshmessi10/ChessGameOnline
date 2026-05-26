from typing import List, Optional
from sqlmodel import Session
from ..repositories.usuario_repository import UsuarioRepository
from ..repositories.statistics_repository import StatisticsRepository
from ..repositories.friendship_repository import FriendshipRepository
from ..repositories.match_repository import MatchRepository
from ..repositories.rating_repository import RatingRepository
from ..models.usuario import Usuario
from ..models.enums import MatchType, FriendshipStatus
from ..schemas.user import UserResponse, UserResult, UserSearchResponse, SettingsDTO, StatsDTO, FriendListItemDTO, MatchHistoryItemDTO

class UserService:
    def __init__(self, session: Session):
        self.user_repo = UsuarioRepository(session)
        self.stats_repo = StatisticsRepository(session)
        self.friend_repo = FriendshipRepository(session)
        self.match_repo = MatchRepository(session)
        self.rating_repo = RatingRepository(session)

    def get_profile(self, user_id: int, modo: Optional[MatchType] = None) -> UserResponse:
        user = self.user_repo.find_by_id(user_id)
        if not user:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="User not found")
            
        stats = self.stats_repo.find_by_usuario_id(user_id)
        stats_dto = None
        if stats:
            stats_dto = StatsDTO(
                partidas_jugadas=stats.partidas_jugadas,
                victorias=stats.victorias,
                derrotas=stats.derrotas,
                empates=stats.empates,
                actualizado_en=stats.actualizado_en
            )
            
        # Get ELO per mode
        bullet_r = self.rating_repo.find_by_usuario_and_modo(user_id, MatchType.BULLET)
        blitz_r = self.rating_repo.find_by_usuario_and_modo(user_id, MatchType.BLITZ)
        rapid_r = self.rating_repo.find_by_usuario_and_modo(user_id, MatchType.RAPID)
        classical_r = self.rating_repo.find_by_usuario_and_modo(user_id, MatchType.CLASSICAL)
        
        target_modo = modo if modo else MatchType.BLITZ
        rating = self.rating_repo.find_by_usuario_and_modo(user_id, target_modo)
        user_elo = rating.rating if rating else 1200
        
        # Get Friends
        friends_data = []
        relations = self.friend_repo.find_by_usuario_id(user_id)
        for rel in relations:
            if rel.estado == FriendshipStatus.ACCEPTED:
                f_id = rel.amigo_id if rel.usuario_id == user_id else rel.usuario_id
                f_user = self.user_repo.find_by_id(f_id)
                f_rating = self.rating_repo.find_by_usuario_and_modo(f_id, MatchType.BLITZ)
                if f_user:
                    friends_data.append(FriendListItemDTO(
                        friendID=f_id,
                        username=f_user.nombre_usuario,
                        userELO=f_rating.rating if f_rating else 1200
                    ))
        
        # Get Match History
        history = []
        matches = self.match_repo.find_by_player_id(user_id)
        for m in matches:
            is_white = m.jugador_blancas_id == user_id
            opponent_id = m.jugador_negras_id if is_white else m.jugador_blancas_id
            opponent = self.user_repo.find_by_id(opponent_id)
            history.append(MatchHistoryItemDTO(
                matchID=m.id,
                opponentUsername=opponent.nombre_usuario if opponent else "Unknown",
                result=m.resultado,
                date=m.creada_en,
                playerColor="white" if is_white else "black",
                modo=m.modo
            ))

            
        return UserResponse(
            id=user.id,
            nombre_usuario=user.nombre_usuario,
            correo=user.correo,
            url_avatar=user.url_avatar,
            pais=user.pais,
            creado_en=user.creado_en,
            userELO=user_elo,
            bulletELO=bullet_r.rating if bullet_r else 1200,
            blitzELO=blitz_r.rating if blitz_r else 1200,
            rapidELO=rapid_r.rating if rapid_r else 1200,
            classicalELO=classical_r.rating if classical_r else 1200,
            stats=stats_dto,
            friendList=friends_data,
            matchHistory=history
        )

    def search_users(self, query: str, current_user_id: int) -> UserSearchResponse:
        users = self.user_repo.search_users(query, exclude_user_id=current_user_id)
        results = []
        for u in users:
            blitz_r = self.rating_repo.find_by_usuario_and_modo(u.id, MatchType.BLITZ)
            results.append(UserResult(
                id=u.id,
                nombre_usuario=u.nombre_usuario,
                url_avatar=u.url_avatar,
                pais=u.pais,
                userELO=blitz_r.rating if blitz_r else 1200
            ))
        return UserSearchResponse(results=results)


    def update_settings(self, user_id: int, settings: SettingsDTO) -> UserResponse:
        user = self.user_repo.find_by_id(user_id)
        if not user:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="User not found")
            
        user.nombre_usuario = settings.nombre_usuario
        user.correo = settings.correo
        user.url_avatar = settings.url_avatar
        user.pais = settings.pais
        
        updated_user = self.user_repo.update(user)
        return self.get_profile(updated_user.id)
