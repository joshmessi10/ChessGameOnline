from typing import List
from fastapi import HTTPException
from sqlmodel import Session
from ..repositories.friendship_repository import FriendshipRepository
from ..repositories.usuario_repository import UsuarioRepository
from ..models.friendship import Friendship
from ..models.enums import FriendshipStatus
from ..schemas.friendship import FriendResponse, FriendshipDTO

class FriendshipService:
    def __init__(self, session: Session):
        self.friend_repo = FriendshipRepository(session)
        self.user_repo = UsuarioRepository(session)

    def send_request(self, sender_id: int, target_id: int) -> FriendResponse:
        if sender_id == target_id:
            raise HTTPException(status_code=400, detail="Cannot add yourself as friend")
            
        existing = self.friend_repo.find_relation(sender_id, target_id)
        if existing and existing.estado in (FriendshipStatus.PENDING, FriendshipStatus.ACCEPTED):
            raise HTTPException(status_code=400, detail=f"Friendship already exists with status: {existing.estado}")
        
        # If rejected before, delete and re-create
        if existing and existing.estado == FriendshipStatus.REJECTED:
            self.friend_repo.delete(existing)
            
        new_friendship = Friendship(
            usuario_id=sender_id,
            amigo_id=target_id,
            estado=FriendshipStatus.PENDING
        )
        saved = self.friend_repo.save(new_friendship)
        return FriendResponse(
            id=saved.id,
            usuario_id=saved.usuario_id,
            amigo_id=saved.amigo_id,
            estado=saved.estado,
            creado_en=saved.creado_en
        )

    def accept_request(self, user_id: int, target_id: int) -> FriendResponse:
        # Find the relation where target_id SENT the request to user_id
        relation = self.friend_repo.find_relation(user_id, target_id)
        if not relation or relation.estado != FriendshipStatus.PENDING:
            raise HTTPException(status_code=404, detail="Pending friend request not found")
        # Verify the current user is the RECIPIENT (amigo_id), not the sender
        if relation.amigo_id != user_id:
            raise HTTPException(status_code=403, detail="You cannot accept a request you sent")
            
        relation.estado = FriendshipStatus.ACCEPTED
        updated = self.friend_repo.update(relation)
        return FriendResponse(
            id=updated.id,
            usuario_id=updated.usuario_id,
            amigo_id=updated.amigo_id,
            estado=updated.estado,
            creado_en=updated.creado_en
        )

    def list_friends(self, user_id: int) -> List[FriendshipDTO]:
        relations = self.friend_repo.find_by_usuario_id(user_id)
        friends = []
        for rel in relations:
            if rel.estado == FriendshipStatus.REJECTED:
                continue
            friend_id = rel.amigo_id if rel.usuario_id == user_id else rel.usuario_id
            friend_user = self.user_repo.find_by_id(friend_id)
            if friend_user:
                friends.append(FriendshipDTO(
                    id=rel.id,
                    amigo_id=friend_id,
                    usuario_id=rel.usuario_id,
                    amigo_name=friend_user.nombre_usuario,
                    estado=rel.estado,
                    url_avatar=friend_user.url_avatar
                ))
        return friends

    def reject_request(self, user_id: int, target_id: int) -> None:
        relation = self.friend_repo.find_relation(user_id, target_id)
        if not relation or relation.amigo_id != user_id or relation.estado != FriendshipStatus.PENDING:
            raise HTTPException(status_code=404, detail="Pending request not found")
        
        relation.estado = FriendshipStatus.REJECTED
        self.friend_repo.update(relation)

    def remove_friend(self, user_id: int, target_id: int) -> None:
        relation = self.friend_repo.find_relation(user_id, target_id)
        if not relation or relation.estado != FriendshipStatus.ACCEPTED:
            raise HTTPException(status_code=404, detail="Friendship not found")
        
        self.friend_repo.delete(relation)
