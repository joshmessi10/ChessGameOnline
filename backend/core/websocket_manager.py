from typing import Dict, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Maps match_id to a list of active WebSockets
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, match_id: int, websocket: WebSocket):
        await websocket.accept()
        if match_id not in self.active_connections:
            self.active_connections[match_id] = []
        self.active_connections[match_id].append(websocket)

    def disconnect(self, match_id: int, websocket: WebSocket):
        if match_id in self.active_connections:
            if websocket in self.active_connections[match_id]:
                self.active_connections[match_id].remove(websocket)
            if not self.active_connections[match_id]:
                del self.active_connections[match_id]

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast_to_match(self, match_id: int, message: dict):
        if match_id in self.active_connections:
            # Create a copy of the list to avoid modification issues during iteration
            for connection in list(self.active_connections[match_id]):
                try:
                    await connection.send_json(message)
                except Exception:
                    # Connection might be dead, remove it safely
                    self.disconnect(match_id, connection)

websocket_manager = ConnectionManager()
