from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import json

from app.api import deps
from app.api.deps import get_db
from app.models.user import User
from app.models.chat import ChatRoom, ChatMessage, ChatParticipant
from app.schemas.chat import (
    ChatRoomCreate, ChatRoomResponse, 
    ChatMessageCreate, ChatMessageResponse,
    ChatParticipantResponse
)
from app.api.ws_manager import manager
from jose import jwt, JWTError
from app.core.config import settings
from app.schemas.token import TokenPayload

router = APIRouter()

@router.get("/rooms")
def get_user_rooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Lấy danh sách các phòng chat của user hiện tại"""
    rooms = db.query(ChatRoom).join(ChatParticipant).filter(
        ChatParticipant.user_id == current_user.id
    ).all()
    
    result = []
    for r in rooms:
        # Lấy thông tin participant của user hiện tại
        p_current = next((p for p in r.participants if p.user_id == current_user.id), None)
        last_read_at = p_current.last_read_at if p_current else None
        
        participants = [{"user_id": p.user_id, "username": p.user.username} for p in r.participants]
        # Lấy tin nhắn mới nhất chưa bị xóa
        last_msg = db.query(ChatMessage).filter(
            ChatMessage.room_id == r.id,
            ChatMessage.is_deleted == False
        ).order_by(ChatMessage.created_at.desc()).first()
        
        # Đếm tin nhắn chưa đọc
        unread_count = 0
        if last_read_at:
            unread_count = db.query(ChatMessage).filter(
                ChatMessage.room_id == r.id,
                ChatMessage.is_deleted == False,
                ChatMessage.created_at > last_read_at,
                ChatMessage.sender_id != current_user.id
            ).count()
        else:
            unread_count = db.query(ChatMessage).filter(
                ChatMessage.room_id == r.id,
                ChatMessage.is_deleted == False,
                ChatMessage.sender_id != current_user.id
            ).count()

        result.append({
            "id": r.id,
            "name": r.name,
            "is_group": r.is_group,
            "project_id": r.project_id,
            "created_at": r.created_at,
            "participants": participants,
            "last_message": last_msg.content if last_msg else None,
            "last_message_at": last_msg.created_at if last_msg else None,
            "unread_count": unread_count
        })
    return result

@router.post("/rooms", response_model=ChatRoomResponse)
def create_room(
    *,
    db: Session = Depends(get_db),
    room_in: ChatRoomCreate,
    current_user: User = Depends(deps.get_current_active_user)
):
    """Tạo phòng chat mới (1-1 hoặc nhóm)"""
    u_ids = set(room_in.participant_ids)
    u_ids.add(current_user.id)
    u_list = list(u_ids)

    # Kiểm tra nếu là chat 1:1 thì đã tồn tại chưa
    if not room_in.is_group and len(u_list) == 2:
        room_ids_user1 = set([p.room_id for p in db.query(ChatParticipant).filter(ChatParticipant.user_id == u_list[0]).all()])
        room_ids_user2 = set([p.room_id for p in db.query(ChatParticipant).filter(ChatParticipant.user_id == u_list[1]).all()])
        common_rooms = list(room_ids_user1.intersection(room_ids_user2))
        
        if common_rooms:
            # Tìm phòng 1:1 trong danh sách phòng chung
            existing_1v1 = db.query(ChatRoom).filter(ChatRoom.id.in_(common_rooms), ChatRoom.is_group == False).first()
            if existing_1v1:
                return existing_1v1

    new_room = ChatRoom(
        name=room_in.name,
        is_group=room_in.is_group,
        project_id=room_in.project_id
    )
    db.add(new_room)
    db.commit()
    db.refresh(new_room)

    # Thêm các thành viên vào phòng
    participants = []
    # Luôn bao gồm người tạo
    u_ids = set(room_in.participant_ids)
    u_ids.add(current_user.id)

    for u_id in u_ids:
        p = ChatParticipant(room_id=new_room.id, user_id=u_id)
        db.add(p)
    
    db.commit()
    return new_room

@router.get("/rooms/{room_id}/messages", response_model=List[ChatMessageResponse])
def get_room_messages(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
    limit: int = 50,
    offset: int = 0
):
    """Lấy lịch sử tin nhắn của một phòng"""
    # Kiểm tra quyền truy cập phòng
    is_member = db.query(ChatParticipant).filter(
        ChatParticipant.room_id == room_id,
        ChatParticipant.user_id == current_user.id
    ).first()
    
    if not is_member:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập phòng này")

    messages = db.query(ChatMessage).filter(
        ChatMessage.room_id == room_id,
        ChatMessage.is_deleted == False
    ).order_by(ChatMessage.created_at.desc()).limit(limit).offset(offset).all()
    
    # Format response để có sender_name
    res = []
    for m in messages:
        res.append({
            "id": m.id,
            "room_id": m.room_id,
            "sender_id": m.sender_id,
            "sender_name": m.sender.username,
            "content": m.content,
            "created_at": m.created_at
        })
    return res

@router.delete("/rooms/{room_id}/messages/{message_id}")
def delete_message(
    room_id: int,
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Xóa hoặc thu hồi tin nhắn của chính mình"""
    msg = db.query(ChatMessage).filter(ChatMessage.id == message_id, ChatMessage.room_id == room_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Không tìm thấy tin nhắn")
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa tin nhắn này")
    
    msg.is_deleted = True
    db.commit()
    return {"status": "success"}

@router.delete("/rooms/{room_id}")
def leave_chat_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Rời khỏi trò chuyện. Nếu phòng không còn ai, xóa phòng."""
    participant = db.query(ChatParticipant).filter(
        ChatParticipant.room_id == room_id,
        ChatParticipant.user_id == current_user.id
    ).first()
    
    if not participant:
        raise HTTPException(status_code=404, detail="Không tìm thấy bạn trong phòng chat này")
    
    db.delete(participant)
    db.commit()
    
    # Kiểm tra số lượng người còn lại trong phòng
    remaining = db.query(ChatParticipant).filter(ChatParticipant.room_id == room_id).count()
    if remaining == 0:
        room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
        if room:
            db.delete(room)
            db.commit()
            
    return {"status": "success"}

from sqlalchemy.sql import func

@router.post("/rooms/{room_id}/read")
def mark_room_read(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Đánh dấu đã đọc phòng chat"""
    participant = db.query(ChatParticipant).filter(
        ChatParticipant.room_id == room_id,
        ChatParticipant.user_id == current_user.id
    ).first()
    
    if not participant:
        raise HTTPException(status_code=404, detail="Không tìm thấy bạn trong phòng chat này")
    
    participant.last_read_at = func.now()
    db.commit()
    return {"status": "success"}

# --- WebSocket cho Chat ---
# Chúng ta sẽ đưa vào main.py sau cho đồng bộ, hoặc đăng ký ở đây

@router.websocket("/ws/{room_id}")
async def chat_websocket_endpoint(
    websocket: WebSocket,
    room_id: int,
    token: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Kênh WebSocket cho Chat theo từng phòng.
    """
    if not token:
        await websocket.close(code=1008)
        return

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_data = TokenPayload(**payload)
        user_id = token_data.sub
    except JWTError:
        await websocket.close(code=1008)
        return

    # Kiểm tra user có trong phòng không
    is_member = db.query(ChatParticipant).filter(
        ChatParticipant.room_id == room_id,
        ChatParticipant.user_id == user_id
    ).first()

    if not is_member:
        await websocket.close(code=1008)
        return

    room_id_str = str(room_id)
    await manager.connect("chat", room_id_str, websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            content = message_data.get("content")

            if content:
                # Lưu vào Database
                new_msg = ChatMessage(
                    room_id=room_id,
                    sender_id=user_id,
                    content=content
                )
                db.add(new_msg)
                db.commit()
                db.refresh(new_msg)

                # Broadcast tới tất cả mọi người trong phòng
                broadcast_data = {
                    "type": "new_message",
                    "id": new_msg.id,
                    "room_id": room_id,
                    "sender_id": user_id,
                    "sender_name": is_member.user.username,
                    "content": content,
                    "created_at": str(new_msg.created_at)
                }
                await manager.broadcast("chat", room_id_str, broadcast_data)

    except WebSocketDisconnect:
        manager.disconnect("chat", room_id_str, websocket)
    except Exception as e:
        print(f"Chat WS Error: {e}")
        manager.disconnect("chat", room_id_str, websocket)
