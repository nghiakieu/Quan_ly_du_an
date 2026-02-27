"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, User, Sparkles, Loader2, Settings, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { api } from '@/lib/api';

interface Message {
    id: string;
    role: 'user' | 'ai';
    content: string;
}

const GLOBAL_HISTORY_KEY = 'ai_global_chat_history';

export default function AIChatBot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'ai',
            content: 'Chào bạn! Mình là AI Trợ lý Quản lý Dự án. Mình đã đọc toàn bộ dữ liệu (Khối lượng, Tiến độ Kanban, Sơ đồ thi công) của dự án này.\n\nBạn muốn biết thông tin gì cứ hỏi mình nhé!'
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [tempApiKey, setTempApiKey] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll xuống tin nhắn mới nhất
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Load History
    useEffect(() => {
        const savedHistory = localStorage.getItem(GLOBAL_HISTORY_KEY);
        if (savedHistory) {
            try {
                setMessages(JSON.parse(savedHistory));
            } catch (e) {
                console.error('Lỗi đọc lịch sử chat AI');
            }
        }
    }, []);

    // Save History & Scroll
    useEffect(() => {
        scrollToBottom();
        localStorage.setItem(GLOBAL_HISTORY_KEY, JSON.stringify(messages));
    }, [messages, isOpen, showSettings]);

    useEffect(() => {
        const savedKey = localStorage.getItem('user_gemini_api_key');
        if (savedKey) {
            setApiKey(savedKey);
            setTempApiKey(savedKey);
        }
    }, []);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();

        if (!input.trim() || isLoading) return;

        const userText = input.trim();
        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: userText };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await api.post('/ai/chat', {
                message: userText,
                api_key: apiKey ? apiKey : undefined
            });

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                content: response.data.response || "Xin lỗi, mình không nhận được phản hồi từ máy chủ."
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (error: any) {
            console.error("AI Chat Error:", error);
            const errorMsg = error.response?.data?.detail || "Đã xảy ra lỗi khi kết nối với AI. Vui lòng kiểm tra lại cấu hình API key.";
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                content: `⚠️ **Lỗi:** ${errorMsg}`
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Cửa sổ Chat */}
            {isOpen && (
                <div className="bg-white w-[380px] sm:w-[450px] h-[550px] max-h-[80vh] rounded-2xl shadow-2xl border border-gray-200 flex flex-col mb-4 overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex justify-between items-center shadow-md z-10">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/20 p-1.5 rounded-lg">
                                <Sparkles className="h-5 w-5 text-yellow-300" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">Trợ lý AI Dự án</h3>
                                <p className="text-[10px] text-blue-100 opacity-90">Powered by Gemini 2.5 Flash</p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={() => {
                                    setMessages([{
                                        id: 'welcome',
                                        role: 'ai',
                                        content: 'Chào bạn! Mình là AI Trợ lý Quản lý Dự án.\n\nMình đã trang bị kiến thức Tổng hợp của **Tất Cả Dự Án** trên hệ thống.\nBạn muốn biết thông tin gì cứ hỏi mình nhé!'
                                    }]);
                                }}
                                className="text-blue-100 p-1.5 rounded-lg transition-colors hover:bg-white/10 hover:text-white"
                                title="Xóa lịch sử trò chuyện"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`text-blue-100 p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-white/20 text-white' : 'hover:bg-white/10 hover:text-white'}`}
                                title="Cài đặt API Key"
                            >
                                <Settings className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-blue-100 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area / Settings Area */}
                    {showSettings ? (
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 flex flex-col items-center justify-center space-y-4">
                            <div className="text-center space-y-2">
                                <h4 className="font-semibold text-gray-800">Cài đặt API Key cá nhân</h4>
                                <p className="text-xs text-gray-500">
                                    Sử dụng API Key riêng của bạn để đảm bảo tốc độ và không bị giới hạn số lần gọi AI.
                                </p>
                            </div>
                            <div className="w-full space-y-3 mt-4">
                                <input
                                    type="password"
                                    placeholder="Nhập Gemini API Key (Bắt đầu với AIza...)"
                                    className="w-full text-sm p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    value={tempApiKey}
                                    onChange={(e) => setTempApiKey(e.target.value)}
                                />
                                <div className="flex gap-2 w-full pt-2">
                                    <button
                                        className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                                        onClick={() => {
                                            setTempApiKey(apiKey);
                                            setShowSettings(false);
                                        }}
                                        type="button"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
                                        onClick={() => {
                                            setApiKey(tempApiKey);
                                            localStorage.setItem('user_gemini_api_key', tempApiKey);
                                            setShowSettings(false);
                                        }}
                                        type="button"
                                    >
                                        Lưu cấu hình
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 space-y-4">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}
                                >
                                    {msg.role === 'ai' && (
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                                            <Bot className="h-4 w-4 text-white" />
                                        </div>
                                    )}

                                    <div
                                        className={`max-w-[80%] px-4 py-2.5 shadow-sm text-sm ${msg.role === 'user'
                                            ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm'
                                            : 'bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-tl-sm prose prose-sm prose-p:leading-relaxed prose-pre:bg-gray-100 prose-pre:text-gray-800'
                                            }`}
                                    >
                                        {msg.role === 'user' ? (
                                            <div className="whitespace-pre-wrap">{msg.content}</div>
                                        ) : (
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {isLoading && (
                                <div className="flex justify-start gap-2">
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center flex-shrink-0 mt-1">
                                        <Bot className="h-4 w-4 text-white" />
                                    </div>
                                    <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                                        <span className="text-xs text-gray-500">Đang phân tích dữ liệu...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}

                    {/* Input Area */}
                    {!showSettings && (
                        <div className="p-3 bg-white border-t border-gray-100">
                            <form
                                onSubmit={handleSendMessage}
                                className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1 pr-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all"
                            >
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Hỏi AI về tiến độ dự án..."
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-3 py-2 outline-none"
                                    disabled={isLoading}
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isLoading}
                                    className={`p-2 rounded-lg flex items-center justify-center transition-all ${input.trim() && !isLoading
                                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            </form>
                            <div className="text-center mt-2 flex justify-between px-1">
                                <span className="text-[9px] text-gray-400 font-medium">
                                    {apiKey ? "🔑 Đang dùng API Key riêng" : "🌐 Đang dùng API Key hệ thống"}
                                </span>
                                <span className="text-[9px] text-gray-400">AI có thể bỏ sót kiểm tra lại.</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Floating Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="group relative bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex items-center justify-center"
                >
                    <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                    <Sparkles className="h-6 w-6 relative z-10" />

                    {/* Badge */}
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                </button>
            )}
        </div>
    );
}
