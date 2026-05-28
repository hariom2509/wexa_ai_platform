from fastapi import WebSocket
from typing import Dict, List

class ConnectionManager:
    def __init__(self):
        # org_id -> list of websockets
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, org_id: int):
        await websocket.accept()
        if org_id not in self.active_connections:
            self.active_connections[org_id] = []
        self.active_connections[org_id].append(websocket)

    def disconnect(self, websocket: WebSocket, org_id: int):
        if org_id in self.active_connections:
            self.active_connections[org_id].remove(websocket)
            if not self.active_connections[org_id]:
                del self.active_connections[org_id]

    async def broadcast_to_org(self, message: str, org_id: int):
        if org_id in self.active_connections:
            for connection in self.active_connections[org_id]:
                await connection.send_text(message)

manager = ConnectionManager()
