"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Sparkles, Loader2, Settings, Trash2, RefreshCw, AlertTriangle, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { api, extractErrorMessage } from '@/lib/api';
import { toast } from 'sonner';

interface Message {
    id: string;
    role: 'user' | 'ai';
    content: string;
    streaming?: boolean; // true while chunk is being received
}

interface Risk {
    level: 'CRITICAL' | 'WARNING' | 'INFO';
    icon: string;
    project: string;
    message: string;
    type: string;
}

interface RiskAnalysis {
    risks: Risk[];
    total: number;
    critical: number;
    warning: number;
    info: number;
}

const GLOBAL_HISTORY_KEY = 'ai_global_chat_history';

const SUGGESTED_QUESTIONS = [
    "Tổng tiến độ các dự án hiện tại là bao nhiêu %?",
    "Hạng mục nào đang vượt khối lượng kế hoạch?",
    "Trụ/Nhịp nào chưa thi công?",
    "Dự án có rủi ro trễ tiến độ không?",
    "Tổng giá trị đã giải ngân là bao nhiêu?",
    "Liệt kê các task Kanban chưa hoàn thành.",
];

// Get base API URL for native fetch (SSE streaming)
function getApiBaseUrl(): string {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
}

export default function AIChatBot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'ai',
            content: 'Chào bạn! Mình là AI Trợ lý Quản lý Dự án. Mình đã đọc toàn bộ dữ liệu (Khối lượng, Tiến độ Kanban, Sơ đồ thi công, Trụ/Nhịp/Đốt) của hệ thống.\n\nBạn muốn biết thông tin gì cứ hỏi mình nhé!'
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [apiKey, setApiKey] = useState('');
    const [tempApiKey, setTempApiKey] = useState('');
    const [riskData, setRiskData] = useState<RiskAnalysis | null>(null);
    const [isLoadingRisk, setIsLoadingRisk] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Load chat history from localStorage
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

    // Save history & scroll on message change
    useEffect(() => {
        scrollToBottom();
        // Only persist non-streaming messages
        const persistent = messages.filter(m => !m.streaming);
        localStorage.setItem(GLOBAL_HISTORY_KEY, JSON.stringify(persistent));
    }, [messages]);

    useEffect(() => {
        scrollToBottom();
    }, [isOpen]);

    useEffect(() => {
        const savedKey = localStorage.getItem('user_gemini_api_key');
        if (savedKey) {
            setApiKey(savedKey);
            setTempApiKey(savedKey);
        }
    }, []);

    // Load risk analysis when chat opens
    const loadRiskAnalysis = useCallback(async () => {
        if (isLoadingRisk || riskData) return;
        setIsLoadingRisk(true);
        try {
            const res = await api.get('/ai/risk-analysis');
            setRiskData(res.data);
        } catch (e) {
            // Silent fail
        } finally {
            setIsLoadingRisk(false);
        }
    }, [isLoadingRisk, riskData]);

    useEffect(() => {
        if (isOpen) loadRiskAnalysis();
    }, [isOpen, loadRiskAnalysis]);

    // ============================================================
    // STREAMING SEND MESSAGE
    // ============================================================
    const handleSendMessage = async (text?: string) => {
        const userText = (text || input).trim();
        if (!userText || isLoading) return;

        // Cancel any ongoing stream
        abortControllerRef.current?.abort();

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: userText };
        const aiMsgId = (Date.now() + 1).toString();
        const aiPlaceholder: Message = { id: aiMsgId, role: 'ai', content: '', streaming: true };

        setMessages(prev => [...prev, userMsg, aiPlaceholder]);
        setInput('');
        setIsLoading(true);
        setShowSuggestions(false);

        const recentHistory = messages
            .filter(m => m.id !== 'welcome' && !m.streaming)
            .slice(-6)
            .map(m => ({ role: m.role, content: m.content }));

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const token = localStorage.getItem('access_token') || '';
            const response = await fetch(`${getApiBaseUrl()}/ai/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    message: userText,
                    api_key: apiKey || undefined,
                    history: recentHistory,
                }),
                signal: controller.signal,
            });

            if (!response.ok || !response.body) {
                throw new Error(`Server error: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let accumulated = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const raw = line.slice(6).trim();
                    if (!raw) continue;

                    try {
                        const parsed = JSON.parse(raw);

                        if (parsed.error) {
                            throw new Error(parsed.error);
                        }

                        if (parsed.done) {
                            // Mark streaming complete
                            setMessages(prev =>
                                prev.map(m =>
                                    m.id === aiMsgId
                                        ? { ...m, content: accumulated, streaming: false }
                                        : m
                                )
                            );
                            break;
                        }

                        if (parsed.token) {
                            accumulated += parsed.token;
                            // Update the streaming message in real-time
                            setMessages(prev =>
                                prev.map(m =>
                                    m.id === aiMsgId
                                        ? { ...m, content: accumulated }
                                        : m
                                )
                            );
                        }
                    } catch (parseErr) {
                        // Skip malformed SSE lines
                    }
                }
            }

            // Finalize if stream ended without done signal
            setMessages(prev =>
                prev.map(m =>
                    m.id === aiMsgId
                        ? { ...m, content: accumulated || '(Không có phản hồi)', streaming: false }
                        : m
                )
            );

        } catch (error: any) {
            if (error.name === 'AbortError') return;

            console.error("AI Stream Error:", error);
            const errText = error.message || "Đã xảy ra lỗi kết nối với AI.";
            setMessages(prev =>
                prev.map(m =>
                    m.id === aiMsgId
                        ? { ...m, content: `⚠️ **Lỗi:** ${errText}`, streaming: false }
                        : m
                )
            );
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        setRiskData(null);
        try {
            const response = await api.get('/ai/sync');
            toast.success(response.data?.message || 'Đồng bộ dữ liệu thành công');
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'ai',
                content: `✅ Hệ thống đã nạp dữ liệu dự án **mới nhất** lên Cache AI! Bạn muốn hỏi gì không?`
            }]);
            setTimeout(() => loadRiskAnalysis(), 500);
        } catch (error: any) {
            toast.error(error.response?.data?.detail || "Lỗi khi đồng bộ dữ liệu.");
        } finally {
            setIsSyncing(false);
        }
    };

    const urgentRiskCount = riskData ? (riskData.critical + riskData.warning) : 0;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Chat Window */}
            {isOpen && (
                <div className="bg-white w-[380px] sm:w-[450px] h-[580px] max-h-[85vh] rounded-2xl shadow-2xl border border-gray-200 flex flex-col mb-4 overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex justify-between items-center shadow-md z-10 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/20 p-1.5 rounded-lg">
                                <Sparkles className="h-5 w-5 text-yellow-300" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">Trợ lý AI Dự án</h3>
                                <p className="text-[10px] text-blue-100 opacity-90">Powered by Gemini 2.5 Flash · Streaming</p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={() => {
                                    abortControllerRef.current?.abort();
                                    setMessages([{
                                        id: 'welcome', role: 'ai',
                                        content: 'Chào bạn! Mình là AI Trợ lý Quản lý Dự án.\n\nBạn muốn biết thông tin gì cứ hỏi mình nhé!'
                                    }]);
                                    setShowSuggestions(true);
                                    setIsLoading(false);
                                }}
                                className="text-blue-100 p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
                                title="Xóa lịch sử"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                            <button
                                onClick={handleSync}
                                disabled={isSyncing}
                                className="text-blue-100 p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
                                title="Đồng bộ dữ liệu mới"
                            >
                                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`text-blue-100 p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-white/20 text-white' : 'hover:bg-white/10 hover:text-white'}`}
                                title="API Key"
                            >
                                <Settings className="h-5 w-5" />
                            </button>
                            <button onClick={() => setIsOpen(false)} className="text-blue-100 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Risk Alert Banner */}
                    {!showSettings && riskData && urgentRiskCount > 0 && (
                        <div
                            className="bg-amber-50 border-b border-amber-200 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-amber-100 transition-colors flex-shrink-0"
                            onClick={() => handleSendMessage("Phân tích chi tiết tất cả rủi ro của các dự án")}
                        >
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                                <span className="text-xs text-amber-800 font-medium">
                                    {riskData.critical > 0
                                        ? `🔴 ${riskData.critical} cảnh báo nghiêm trọng`
                                        : `⚠️ ${riskData.warning} cảnh báo rủi ro`
                                    } — Click để xem
                                </span>
                            </div>
                            <ChevronDown className="h-3 w-3 text-amber-500" />
                        </div>
                    )}

                    {/* Settings Panel */}
                    {showSettings ? (
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 flex flex-col items-center justify-center space-y-4">
                            <div className="text-center space-y-2">
                                <h4 className="font-semibold text-gray-800">API Key cá nhân</h4>
                                <p className="text-xs text-gray-500">Dùng key riêng để tránh giới hạn tốc độ.</p>
                            </div>
                            <div className="w-full space-y-3">
                                <input
                                    type="password"
                                    placeholder="AIza... (Gemini API Key)"
                                    className="w-full text-sm p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    value={tempApiKey}
                                    onChange={(e) => setTempApiKey(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <button className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-300 transition-colors"
                                        onClick={() => { setTempApiKey(apiKey); setShowSettings(false); }}>Hủy</button>
                                    <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                                        onClick={() => {
                                            setApiKey(tempApiKey);
                                            localStorage.setItem('user_gemini_api_key', tempApiKey);
                                            setShowSettings(false);
                                        }}>Lưu</button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Messages Area */
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 space-y-4">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
                                    {msg.role === 'ai' && (
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                                            <Bot className="h-4 w-4 text-white" />
                                        </div>
                                    )}
                                    <div className={`max-w-[80%] px-4 py-2.5 shadow-sm text-sm ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm'
                                        : 'bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-tl-sm prose prose-sm prose-p:leading-relaxed prose-pre:bg-gray-100'
                                        }`}>
                                        {msg.role === 'user' ? (
                                            <p className="whitespace-pre-wrap m-0">{msg.content}</p>
                                        ) : (
                                            <>
                                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                                {/* Typewriter cursor while streaming */}
                                                {msg.streaming && (
                                                    <span className="inline-block w-1.5 h-4 bg-blue-500 animate-pulse ml-0.5 align-middle rounded-sm" />
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Suggested Questions */}
                            {showSuggestions && messages.length <= 2 && !isLoading && (
                                <div className="space-y-2 pt-1">
                                    <p className="text-xs text-gray-400 font-medium text-center">💡 Câu hỏi gợi ý</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {SUGGESTED_QUESTIONS.map((q, i) => (
                                            <button key={i} onClick={() => handleSendMessage(q)}
                                                className="text-xs bg-white border border-blue-100 text-blue-700 px-3 py-1.5 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all text-left">
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Loading spinner — only when no streaming message yet */}
                            {isLoading && !messages.find(m => m.streaming) && (
                                <div className="flex justify-start gap-2">
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center flex-shrink-0 mt-1">
                                        <Bot className="h-4 w-4 text-white" />
                                    </div>
                                    <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                                        <span className="text-xs text-gray-500">Đang phân tích...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}

                    {/* Input Area */}
                    {!showSettings && (
                        <div className="p-3 bg-white border-t border-gray-100 flex-shrink-0">
                            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                                className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1 pr-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Hỏi AI về tiến độ dự án..."
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-3 py-2 outline-none"
                                    disabled={isLoading}
                                />
                                {isLoading ? (
                                    <button type="button" onClick={() => abortControllerRef.current?.abort()}
                                        className="p-2 rounded-lg bg-red-100 text-red-500 hover:bg-red-200 transition-all" title="Dừng">
                                        <X className="h-4 w-4" />
                                    </button>
                                ) : (
                                    <button type="submit" disabled={!input.trim()}
                                        className={`p-2 rounded-lg flex items-center justify-center transition-all ${input.trim() ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                                        <Send className="h-4 w-4" />
                                    </button>
                                )}
                            </form>
                            <div className="text-center mt-1.5 flex justify-between px-1">
                                <span className="text-[9px] text-gray-400">
                                    {apiKey ? "🔑 API Key riêng" : "🌐 API Key hệ thống"}
                                </span>
                                <span className="text-[9px] text-gray-400">Streaming · AI có thể bỏ sót</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Floating Button */}
            {!isOpen && (
                <button onClick={() => setIsOpen(true)}
                    className="group relative bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <Sparkles className="h-6 w-6" />
                    {urgentRiskCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-pulse z-20">
                            {urgentRiskCount > 9 ? '9+' : urgentRiskCount}
                        </span>
                    )}
                </button>
            )}
        </div>
    );
}
