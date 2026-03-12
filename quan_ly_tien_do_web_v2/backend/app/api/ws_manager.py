from typing import Dict, List, Set
from fastapi import WebSocket
import json

class ConnectionManager:
    def __init__(self):
        # Lưu các kết nối theo map: category (diagram/chat) -> room_id -> List[WebSocket]
        self.active_connections: Dict[str, Dict[str, List[WebSocket]]] = {
            "diagram": {},
            "chat": {}
        }

    async def connect(self, category: str, room_id: str, websocket: WebSocket):
        await websocket.accept()
        if category not in self.active_connections:
            self.active_connections[category] = {}
        if room_id not in self.active_connections[category]:
            self.active_connections[category][room_id] = []
        self.active_connections[category][room_id].append(websocket)

    def disconnect(self, category: str, room_id: str, websocket: WebSocket):
        if category in self.active_connections and room_id in self.active_connections[category]:
            try:
                self.active_connections[category][room_id].remove(websocket)
                if not self.active_connections[category][room_id]:
                    del self.active_connections[category][room_id]
            except ValueError:
                pass

    async def broadcast(self, category: str, room_id: str, message: dict, exclude: WebSocket = None):
        """
        Gửi message JSON tới tất cả các client trong một room cụ thể
        """
        if category in self.active_connections and room_id in self.active_connections[category]:
            for connection in self.active_connections[category][room_id]:
                if connection != exclude:
                    try:
                        await connection.send_json(message)
                    except Exception:
                        pass

    # Tương thích ngược với code cũ của Diagram
    async def connect_diagram(self, diagram_id: str, websocket: WebSocket):
        await self.connect("diagram", diagram_id, websocket)

    def disconnect_diagram(self, diagram_id: str, websocket: WebSocket):
        self.disconnect("diagram", diagram_id, websocket)

    async def broadcast_to_diagram(self, diagram_id: str, message: dict, exclude: WebSocket = None):
        await self.broadcast("diagram", diagram_id, message, exclude)

manager = ConnectionManager()
