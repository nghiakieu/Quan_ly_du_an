from typing import Dict, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Lưu các kết nối theo map: diagram_id -> List[WebSocket]
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, diagram_id: str, websocket: WebSocket):
        await websocket.accept()
        if diagram_id not in self.active_connections:
            self.active_connections[diagram_id] = []
        self.active_connections[diagram_id].append(websocket)

    def disconnect(self, diagram_id: str, websocket: WebSocket):
        if diagram_id in self.active_connections:
            try:
                self.active_connections[diagram_id].remove(websocket)
                if not self.active_connections[diagram_id]:
                    del self.active_connections[diagram_id]
            except ValueError:
                pass

    async def broadcast_to_diagram(self, diagram_id: str, message: dict, exclude: WebSocket = None):
        """
        Gửi message JSON tới tất cả các client đang xem cùng một sơ đồ
        exclude: Bỏ qua không gửi lại cho chính Client vừa gửi thay đổi
        """
        if diagram_id in self.active_connections:
            for connection in self.active_connections[diagram_id]:
                if connection != exclude:
                    try:
                        await connection.send_json(message)
                    except Exception:
                        pass # Dummy catch to not break loop if a socket dropped ungracefully

manager = ConnectionManager()
