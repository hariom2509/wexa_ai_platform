from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.websocket_manager import manager

router = APIRouter()

@router.websocket("/{org_id}")
async def websocket_endpoint(websocket: WebSocket, org_id: int):
    await manager.connect(websocket, org_id)
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            # E.g. ping/pong could go here
    except WebSocketDisconnect:
        manager.disconnect(websocket, org_id)