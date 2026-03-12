from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ChatMessageBase(BaseModel):
    content: str

class ChatMessageCreate(ChatMessageBase):
    room_id: int

class ChatMessageResponse(ChatMessageBase):
    id: int
    room_id: int
    sender_id: int
    sender_name: str
    created_at: datetime

    class Config:
        from_attributes = True

class ChatRoomBase(BaseModel):
    name: Optional[str] = None
    is_group: bool = False
    project_id: Optional[int] = None

class ChatRoomCreate(ChatRoomBase):
    participant_ids: List[int]

class ChatRoomResponse(ChatRoomBase):
    id: int
    created_at: datetime
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ChatParticipantResponse(BaseModel):
    user_id: int
    username: str
    joined_at: datetime

    class Config:
        from_attributes = True
