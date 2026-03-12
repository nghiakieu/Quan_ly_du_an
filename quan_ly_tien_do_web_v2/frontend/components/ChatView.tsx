'use client';

import { useState, useEffect, useRef } from 'react';
import { api, getAllUsersPublic, createChatRoom, UserInfo, deleteChatMessage, leaveChatRoom, markRoomRead } from '@/lib/api';
import { Send, User, Users, MessageSquare, ArrowLeft, Plus, X, Search, Trash2, LogOut } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
    id: number;
    room_id: number;
    sender_id: number;
    sender_name: string;
    content: string;
    created_at: string;
    type?: string;
}

interface Room {
    id: number;
    name: string | null;
    is_group: boolean;
    last_message?: string;
    unread_count?: number;
    participants?: { user_id: number; username: string }[];
}

export default function ChatView({ onClose }: { onClose?: () => void }) {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    
    // Tạo mới states
    const [showNewChat, setShowNewChat] = useState(false);
    const [users, setUsers] = useState<UserInfo[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
    const [groupName, setGroupName] = useState('');
    const [isGroupMode, setIsGroupMode] = useState(false);
    
    // Thêm state cho tab
    const [activeTab, setActiveTab] = useState<'individual' | 'group'>('individual');
    
    // Thêm state cho tìm kiếm phòng
    const [isSearchingRoom, setIsSearchingRoom] = useState(false);
    const [roomSearchQuery, setRoomSearchQuery] = useState('');
    
    // Thêm state cho tìm kiếm tin nhắn
    const [isSearchingMessage, setIsSearchingMessage] = useState(false);
    const [messageSearchQuery, setMessageSearchQuery] = useState('');

    const fetchRooms = async () => {
        try {
            const res = await api.get('/chat/rooms');
            setRooms(res.data);
        } catch (err) {
            console.error('Lỗi lấy phòng chat:', err);
        }
    };

    useEffect(() => {
        fetchRooms();
    }, []);

    useEffect(() => {
        if (!selectedRoom) return;

        setIsSearchingMessage(false);
        setMessageSearchQuery('');

        // Đánh dấu đã đọc khi vào phòng
        const markAsRead = async () => {
            try {
                await markRoomRead(selectedRoom.id);
                setRooms(prevRooms => prevRooms.map(r => r.id === selectedRoom.id ? { ...r, unread_count: 0 } : r));
            } catch (err) {
                console.error("Lỗi đánh dấu đã đọc", err);
            }
        };
        markAsRead();

        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
        const wsBase = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
        const wsUrl = `${wsBase}/api/v1/chat/ws/${selectedRoom.id}?token=${token}`;

        const ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'new_message') {
                setMessages(prev => [...prev, data]);
            }
        };
        setSocket(ws);

        const fetchHistory = async () => {
            try {
                const res = await api.get(`/chat/rooms/${selectedRoom.id}/messages`);
                setMessages(res.data.reverse());
            } catch (err) {
                toast.error('Không thể tải lịch sử tin nhắn');
            }
        };
        fetchHistory();

        return () => ws.close();
    }, [selectedRoom]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (showNewChat && users.length === 0) {
            getAllUsersPublic().then(setUsers).catch(console.error);
        }
    }, [showNewChat, users.length]);

    const sendMessage = () => {
        if (!newMessage.trim() || !socket) return;
        socket.send(JSON.stringify({ content: newMessage }));
        setNewMessage('');
    };

    const handleCreateChat = async () => {
        if (selectedUserIds.length === 0) return toast.warning('Vui lòng chọn người để chat');
        if (isGroupMode && !groupName.trim()) return toast.warning('Vui lòng nhập tên nhóm');
        
        try {
            const newRoom = await createChatRoom({
                name: isGroupMode ? groupName : undefined,
                is_group: isGroupMode || selectedUserIds.length > 1,
                participant_ids: selectedUserIds
            });
            await fetchRooms();
            setShowNewChat(false);
            setSelectedUserIds([]);
            setGroupName('');
            setSelectedRoom(newRoom);
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Lỗi tạo chat');
        }
    };

    const getCurrentUserId = () => {
        try {
            const token = localStorage.getItem('access_token') || localStorage.getItem('token');
            if (!token) return null;
            const payload = JSON.parse(atob(token.split('.')[1]));
            return Number(payload.sub);
        } catch {
            return null;
        }
    };

    const currentUserId = getCurrentUserId();
    const filteredUsers = users.filter(u => 
        u.id !== currentUserId && 
        (u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
         u.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const getRoomName = (room: Room) => {
        if (room.is_group && room.name) return room.name;
        if (!room.is_group && room.participants) {
            const otherParticipant = room.participants.find(p => p.user_id !== currentUserId);
            return otherParticipant ? otherParticipant.username : 'Chat 1:1';
        }
        return room.name || 'Phòng chat';
    };

    const handleDeleteMsg = async (msgId: number) => {
        if (!selectedRoom) return;
        if (!window.confirm("Bạn có chắc muốn xóa tin nhắn này?")) return;
        try {
            await deleteChatMessage(selectedRoom.id, msgId);
            setMessages(prev => prev.filter(m => m.id !== msgId));
            toast.success("Đã xóa tin nhắn");
        } catch (error) {
            toast.error("Không thể xóa tin nhắn");
        }
    };

    const handleLeaveOrDeleteRoom = async () => {
        if (!selectedRoom) return;
        const act = selectedRoom.is_group ? "rời nhóm" : "xóa cuộc trò chuyện";
        if (!window.confirm(`Bạn có chắc muốn ${act} này?`)) return;
        try {
            await leaveChatRoom(selectedRoom.id);
            setRooms(prev => prev.filter(r => r.id !== selectedRoom.id));
            setSelectedRoom(null);
            toast.success(`Đã ${act} thành công`);
        } catch (error) {
            toast.error(`Không thể ${act}`);
        }
    };

    const filteredRooms = rooms.filter(room => {
        const matchesTab = activeTab === 'group' ? room.is_group : !room.is_group;
        if (!matchesTab) return false;
        
        if (!roomSearchQuery) return true;
        
        const q = roomSearchQuery.toLowerCase();
        
        // Check room name / username
        const roomName = getRoomName(room).toLowerCase();
        if (roomName.includes(q)) return true;
        
        // Check last message
        if (room.last_message && room.last_message.toLowerCase().includes(q)) return true;
        
        return false;
    });

    // Màn hình 1: Danh sách phòng
    if (!selectedRoom && !showNewChat) {
        return (
            <div className="flex flex-col h-full bg-white">
                <div className="p-4 flex justify-between items-center bg-blue-600 text-white shadow-md z-10 transition-all min-h-[60px]">
                    {isSearchingRoom ? (
                        <div className="flex-1 flex items-center bg-white/20 rounded-full px-3 py-1 animate-in fade-in slide-in-from-right-4 duration-300">
                            <Search size={16} className="text-white/70 mr-2 flex-shrink-0" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Tìm phòng, người hoặc tin nhắn..."
                                className="bg-transparent border-none outline-none text-sm text-white placeholder-white/60 w-full"
                                value={roomSearchQuery}
                                onChange={(e) => setRoomSearchQuery(e.target.value)}
                            />
                            <button onClick={() => { setIsSearchingRoom(false); setRoomSearchQuery(''); }} className="p-1 hover:bg-white/20 ml-1 rounded-full text-white/70 hover:text-white transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="font-bold flex items-center gap-2">
                                <MessageSquare size={18} /> Chat Nội Bộ
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setIsSearchingRoom(true)} className="p-1 hover:bg-white/20 rounded transition-colors" title="Tìm kiếm">
                                    <Search size={20} />
                                </button>
                                <button onClick={() => setShowNewChat(true)} className="p-1 hover:bg-white/20 rounded transition-colors" title="Chat mới">
                                    <Plus size={20} />
                                </button>
                                {onClose && (
                                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded transition-colors" title="Đóng">
                                        <X size={20} />
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
                
                {/* Tabs */}
                <div className="flex bg-white border-b">
                    <button 
                        onClick={() => setActiveTab('individual')} 
                        className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'individual' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
                    >
                        Chat Riêng
                    </button>
                    <button 
                        onClick={() => setActiveTab('group')} 
                        className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'group' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
                    >
                        Chat Nhóm
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {filteredRooms.map(room => (
                        <div
                            key={room.id}
                            onClick={() => setSelectedRoom(room)}
                            className="p-3 mx-2 my-1 rounded-xl hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                            <div className="font-medium flex items-center gap-2 text-gray-900 flex-1 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0 relative">
                                    {room.is_group ? <Users size={16} /> : <User size={16} />}
                                    {room.unread_count ? (
                                        <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] text-white font-bold border border-white">
                                            {room.unread_count > 9 ? '9+' : room.unread_count}
                                        </span>
                                    ) : null}
                                </div>
                                <div className="truncate flex-1">
                                    {getRoomName(room)}
                                </div>
                            </div>
                            <div className="text-xs text-gray-500 truncate mt-1 flex items-center pl-10">
                                <span className={`truncate flex-1 ${room.unread_count ? 'font-bold text-gray-900' : ''}`}>
                                  {room.last_message ? room.last_message : 'Chưa có tin nhắn...'}
                                </span>
                            </div>
                        </div>
                    ))}
                    {filteredRooms.length === 0 && (
                        <div className="p-8 flex flex-col items-center justify-center text-gray-400 h-full">
                            <MessageSquare className="opacity-20 mb-2" size={48} />
                            <p className="text-sm">Chưa có {activeTab === 'individual' ? 'cuộc trò chuyện cá nhân' : 'nhóm chat'} nào</p>
                            <button onClick={() => { setShowNewChat(true); setIsGroupMode(activeTab === 'group'); }} className="mt-4 text-blue-600 font-medium hover:underline text-sm">
                                Bắt đầu trò chuyện
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Màn hình 2: Tạo chat mới
    if (showNewChat) {
        return (
            <div className="flex flex-col h-full bg-white">
                <div className="p-4 flex items-center gap-3 bg-blue-600 text-white">
                    <button onClick={() => setShowNewChat(false)} className="p-1 hover:bg-white/20 rounded"><ArrowLeft size={18}/></button>
                    <span className="font-bold">Tạo Trò Chuyện Mới</span>
                </div>
                
                <div className="p-3 border-b bg-gray-50">
                    <div className="flex gap-2 mb-3">
                        <button onClick={() => { setIsGroupMode(false); setSelectedUserIds([]); }} className={`flex-1 py-1.5 text-xs font-semibold rounded-md border transition-colors ${!isGroupMode ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-300'}`}>1:1 Chat</button>
                        <button onClick={() => { setIsGroupMode(true); setSelectedUserIds([]); }} className={`flex-1 py-1.5 text-xs font-semibold rounded-md border transition-colors ${isGroupMode ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-300'}`}>Group Chat</button>
                    </div>

                    {isGroupMode && (
                        <input type="text" placeholder="Tên nhóm..." className="w-full px-3 py-2 text-sm border rounded-md mb-2 outline-none focus:border-blue-500" value={groupName} onChange={e => setGroupName(e.target.value)} />
                    )}

                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="Tìm người dùng..." className="w-full pl-8 pr-3 py-2 text-sm border rounded-md outline-none focus:border-blue-500" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {filteredUsers.map(u => (
                        <div key={u.id} className="p-3 flex items-center justify-between border-b hover:bg-blue-50 cursor-pointer" 
                             onClick={() => {
                                 if (isGroupMode) {
                                     setSelectedUserIds(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]);
                                 } else {
                                     setSelectedUserIds([u.id]);
                                 }
                             }}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">{u.username.charAt(0).toUpperCase()}</div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-gray-900 leading-tight">{u.username}</span>
                                    <span className="text-xs text-gray-500">{u.email}</span>
                                </div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${selectedUserIds.includes(u.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'}`}>
                                {selectedUserIds.includes(u.id) && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                        </div>
                    ))}
                    {filteredUsers.length === 0 && (
                        <div className="p-8 text-center text-sm text-gray-400">Không tìm thấy người dùng</div>
                    )}
                </div>
                
                <div className="p-3 border-t bg-white">
                    <button onClick={handleCreateChat} disabled={selectedUserIds.length === 0 || (isGroupMode && !groupName.trim())} className="w-full py-2 bg-blue-600 text-white rounded-md font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors shadow-sm">
                        Bắt đầu Chat
                    </button>
                </div>
            </div>
        );
    }

    // Màn hình 3: Đang chat
    return (
        <div className="flex flex-col h-full bg-gray-50">
            <div className="p-3 bg-blue-600 text-white border-b border-blue-700 flex items-center gap-2 shadow-sm z-10 transition-all min-h-[56px]">
                <button onClick={() => { setSelectedRoom(null); setMessages([]); fetchRooms(); }} className="p-1 hover:bg-white/20 rounded-full transition-colors"><ArrowLeft size={18}/></button>
                
                {isSearchingMessage ? (
                    <div className="flex-1 flex items-center bg-white/20 rounded-full px-3 py-1 animate-in fade-in slide-in-from-right-4 duration-300">
                        <Search size={14} className="text-white/70 mr-2 flex-shrink-0" />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Tìm kiếm tin nhắn..."
                            className="bg-transparent border-none outline-none text-sm text-white placeholder-white/60 w-full"
                            value={messageSearchQuery}
                            onChange={(e) => setMessageSearchQuery(e.target.value)}
                        />
                        <button onClick={() => { setIsSearchingMessage(false); setMessageSearchQuery(''); }} className="p-1 hover:bg-white/20 ml-1 rounded-full text-white/70 hover:text-white transition-colors">
                            <X size={14} />
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                                {selectedRoom?.is_group ? <Users size={14} /> : <User size={14} />}
                            </div>
                            <div className="truncate font-medium text-sm pr-2">{selectedRoom ? getRoomName(selectedRoom) : 'Đang trò chuyện'}</div>
                        </div>
                        
                        <button onClick={() => setIsSearchingMessage(true)} className="p-1.5 hover:bg-white/20 rounded transition-colors text-white/90" title="Tìm kiếm tin nhắn">
                            <Search size={16} />
                        </button>
                        
                        <button onClick={handleLeaveOrDeleteRoom} className="p-1.5 hover:bg-red-500/80 hover:text-white rounded transition-colors text-white/90" title={selectedRoom?.is_group ? "Rời nhóm" : "Xóa cuộc trò chuyện"}>
                            <Trash2 size={16} />
                        </button>
                    </>
                )}

                {onClose && !isSearchingMessage && (
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors" title="Đóng">
                        <X size={18} />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.filter(msg => !messageSearchQuery || msg.content.toLowerCase().includes(messageSearchQuery.toLowerCase())).map((msg, idx) => {
                    const isMe = msg.sender_id === currentUserId;
                    return (
                        <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}>
                            {!isMe && <div className="text-[10px] text-gray-500 mb-1 px-1 font-medium">{msg.sender_name}</div>}
                            <div className="flex items-center gap-2">
                                {isMe && (
                                    <button onClick={() => handleDeleteMsg(msg.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity" title="Xóa tin nhắn">
                                        <Trash2 size={14} />
                                    </button>
                                )}
                                <div className={`max-w-[100%] px-3 py-2 text-sm leading-relaxed shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' : 'bg-white border text-gray-800 rounded-2xl rounded-tl-sm'}`}>
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={scrollRef} />
            </div>

            <div className="p-3 bg-white border-t flex gap-2 items-end">
                <textarea
                    placeholder="Nhập tin nhắn..."
                    className="flex-1 px-4 py-2 bg-gray-100 border-transparent rounded-2xl text-sm outline-none focus:ring-2 ring-blue-200 focus:bg-white transition-all text-gray-700 resize-none overflow-hidden min-h-[40px] max-h-[120px]"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                        }
                    }}
                    rows={1}
                />
                <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className={`p-2.5 rounded-full transition-all flex items-center justify-center flex-shrink-0 ${newMessage.trim() ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md transform hover:scale-105' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                >
                    <Send size={16} />
                </button>
            </div>
        </div>
    );
}
