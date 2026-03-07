"""
C5: WebSocket endpoint for multiplayer cursor presence.
Real-time cursor position sharing between users editing the same diagram.
"""
import json
import asyncio
from typing import Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from collections import defaultdict

router = APIRouter()

# Map: diagram_id -> set of active WebSocket connections
active_connections: Dict[str, Dict[str, WebSocket]] = defaultdict(dict)


@router.websocket("/ws/diagram/{diagram_id}")
async def websocket_diagram_presence(
    websocket: WebSocket,
    diagram_id: str,
    username: str = Query(default="Anonymous"),
    user_color: str = Query(default="#3b82f6"),
):
    """
    WebSocket endpoint for real-time cursor presence in a diagram.
    
    Client sends:  {"type": "cursor", "x": 100, "y": 200}
    Server broadcasts: {"type": "cursor", "userId": "ws_id", "username": "...", "color": "...", "x": 100, "y": 200}
    """
    await websocket.accept()
    
    # Use a unique ID per connection
    conn_id = f"{username}_{id(websocket)}"
    active_connections[diagram_id][conn_id] = websocket
    
    # Notify others that someone joined
    join_msg = json.dumps({
        "type": "join",
        "userId": conn_id,
        "username": username,
        "color": user_color,
    })
    await _broadcast_to_others(diagram_id, conn_id, join_msg)
    
    # Send current presence list to new joiner
    presence_list = [
        {"userId": cid, "username": cid.rsplit("_", 1)[0]}
        for cid in active_connections[diagram_id]
        if cid != conn_id
    ]
    await websocket.send_text(json.dumps({
        "type": "presence_list",
        "users": presence_list,
    }))
    
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            
            # Add sender info to message before broadcasting
            data["userId"] = conn_id
            data["username"] = username
            data["color"] = user_color
            
            await _broadcast_to_others(diagram_id, conn_id, json.dumps(data))
    
    except WebSocketDisconnect:
        pass
    finally:
        # Cleanup on disconnect
        active_connections[diagram_id].pop(conn_id, None)
        if not active_connections[diagram_id]:
            del active_connections[diagram_id]
        
        # Notify others that user left
        leave_msg = json.dumps({
            "type": "leave",
            "userId": conn_id,
            "username": username,
        })
        await _broadcast_to_others(diagram_id, conn_id, leave_msg)


async def _broadcast_to_others(diagram_id: str, sender_id: str, message: str):
    """Broadcast message to all connections in a diagram except the sender."""
    dead_connections = []
    for cid, ws in active_connections.get(diagram_id, {}).items():
        if cid == sender_id:
            continue
        try:
            await ws.send_text(message)
        except Exception:
            dead_connections.append(cid)
    
    # Clean up dead connections
    for cid in dead_connections:
        active_connections[diagram_id].pop(cid, None)
