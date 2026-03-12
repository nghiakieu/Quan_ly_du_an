"use client";

import React, { useState, useEffect } from 'react';
import ChatView from '@/components/ChatView';
import { MessageCircle, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function GlobalChatPopup() {
    const [showChat, setShowChat] = useState(false);
    const { isAuthenticated } = useAuth();
    const [totalUnread, setTotalUnread] = useState(0);
    
    useEffect(() => {
        if (!isAuthenticated) return;
        
        const fetchUnread = async () => {
            try {
                const res = await api.get('/chat/rooms');
                const count = res.data.reduce((acc: number, room: any) => acc + (room.unread_count || 0), 0);
                setTotalUnread(count);
            } catch (err) {
                // ignore
            }
        };

        fetchUnread();
        const interval = setInterval(fetchUnread, 10000); // Check mỗi 10s
        return () => clearInterval(interval);
    }, [isAuthenticated]);

    // Chỉ hiển thị Chat nội bộ khi đã đăng nhập
    if (!isAuthenticated) return null;

    return (
        <div className="fixed bottom-6 right-24 z-40 flex flex-col items-end">
            {/* Chat Modal */}
            {showChat && (
                <div className="mb-4 w-96 max-h-[70vh] h-[600px] bg-white shadow-2xl shadow-blue-900/20 rounded-xl border border-gray-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200 origin-bottom-right">
                    <ChatView onClose={() => setShowChat(false)} />
                </div>
            )}

            {/* Floating Chat Button */}
            <button
                onClick={() => {
                    setShowChat(!showChat);
                    if (!showChat) setTotalUnread(0); // optimistically clear notification
                }}
                className="p-4 bg-blue-600 text-white rounded-full shadow-2xl shadow-blue-600/30 hover:bg-blue-700 transition-all hover:scale-110 active:scale-95 z-40 group relative"
            >
                {showChat ? <X size={24} /> : <MessageCircle size={24} />}
                {!showChat && totalUnread > 0 && (
                    <span className="absolute top-0 right-0 -translate-y-1 translate-x-1 flex h-5 w-5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 border-2 border-white text-[10px] text-white items-center justify-center font-bold">
                            {totalUnread > 9 ? '9+' : totalUnread}
                        </span>
                    </span>
                )}
                {!showChat && (
                    <span className="absolute right-full top-1/2 -translate-y-1/2 mr-3 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Chat nội bộ
                    </span>
                )}
            </button>
        </div>
    );
}
