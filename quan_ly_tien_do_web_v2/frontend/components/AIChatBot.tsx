"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Sparkles, Loader2, Settings, Trash2, RefreshCw, AlertTriangle, ChevronDown, Plus, MessageSquare, Clock, FileDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { api, extractErrorMessage } from '@/lib/api';
import { toast } from 'sonner';

interface Message {
    id: string;
    role: 'user' | 'ai';
    content: string;
    streaming?: boolean; // true while chunk is being received
}

interface Conversation {
    id: number;
    title: string;
    project_id: number | null;
    created_at: string;
    updated_at: string;
    message_count: number;
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

// Legacy key (kept to migrate old users - no longer written to)
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
    const WELCOME_MSG: Message = {
        id: 'welcome',
        role: 'ai',
        content: 'Chào bạn! Mình là AI Trợ lý Quản lý Dự án. Mình đã đọc toàn bộ dữ liệu (Khối lượng, Tiến độ Kanban, Sơ đồ thi công, Trụ/Nhịp/Đốt) của hệ thống.\n\nBạn muốn biết thông tin gì cứ hỏi mình nhé!'
    };
    const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [showConversations, setShowConversations] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [tempApiKey, setTempApiKey] = useState('');
    const [riskData, setRiskData] = useState<RiskAnalysis | null>(null);
    const [isLoadingRisk, setIsLoadingRisk] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    // Phase 4: conversation persistence
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
    const [isLoadingConversations, setIsLoadingConversations] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Phase 4: Load conversation list from API
    const loadConversations = useCallback(async () => {
        setIsLoadingConversations(true);
        try {
            const res = await api.get('/ai/conversations');
            setConversations(res.data);
        } catch (e) {
            console.error('Lỗi tải danh sách hội thoại');
        } finally {
            setIsLoadingConversations(false);
        }
    }, []);

    // Phase 4: Load messages from a conversation
    const loadConversationMessages = useCallback(async (convId: number) => {
        try {
            const res = await api.get(`/ai/conversations/${convId}/messages`);
            const msgs: Message[] = res.data.messages.map((m: any) => ({
                id: String(m.id),
                role: m.role as 'user' | 'ai',
                content: m.content,
            }));
            setMessages([WELCOME_MSG, ...msgs]);
            setCurrentConversationId(convId);
            setShowConversations(false);
            setShowSuggestions(false);
        } catch (e) {
            toast.error('Không thể tải hội thoại này');
        }
    }, []);

    // Scroll on message change
    useEffect(() => {
        scrollToBottom();
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

    useEffect(() => {
        if (isOpen) loadConversations();
    }, [isOpen, loadConversations]);

    // Load risk analysis when chat opens
    const loadRiskAnalysis = useCallback(async () => {
        if (isLoadingRisk || riskData) return;
        setIsLoadingRisk(true);
        try {
            // Tạm thời vô hiệu hóa theo yêu cầu
            // const res = await api.get('/ai/risk-analysis');
            // setRiskData(res.data);
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
                    conversation_id: currentConversationId, // Phase 4
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
                            // Phase 4: update conversation ID from server
                            if (parsed.conversation_id) {
                                setCurrentConversationId(parsed.conversation_id);
                                // Refresh conversation list silently
                                loadConversations();
                            }
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

    const handleExportReport = async () => {
        setIsExporting(true);
        try {
            const res = await api.post('/ai/generate-report', {
                project_id: null,
                api_key: apiKey || null
            }, {
                responseType: 'blob'
            });
            
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            const contentDisposition = res.headers['content-disposition'];
            let fileName = 'Bao_cao_Du_an.docx';
            if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (fileNameMatch && fileNameMatch.length === 2) {
                    fileName = fileNameMatch[1];
                } else {
                    const idx = contentDisposition.indexOf('filename=');
                    if (idx >= 0) fileName = contentDisposition.slice(idx + 9).replace(/"/g, '');
                }
            }
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success("Đã tải xuống báo cáo!");
        } catch (error: any) {
            toast.error("Lỗi khi xuất báo cáo: Vui lòng kiểm tra lại API Key.");
        } finally {
            setIsExporting(false);
        }
    };

    const urgentRiskCount = riskData ? (riskData.critical + riskData.warning) : 0;

    // Phase 4: Start a new conversation (reset UI only, backend creates lazily)
    const handleNewChat = () => {
        abortControllerRef.current?.abort();
        setCurrentConversationId(null);
        setMessages([WELCOME_MSG]);
        setShowSuggestions(true);
        setIsLoading(false);
        setShowConversations(false);
    };

    // Phase 4: Delete a conversation
    const handleDeleteConversation = async (convId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Xóa hội thoại này?')) return;
        try {
            await api.delete(`/ai/conversations/${convId}`);
            setConversations(prev => prev.filter(c => c.id !== convId));
            if (currentConversationId === convId) handleNewChat();
            toast.success('Xóa thành công');
        } catch {
            toast.error('Không thể xóa hội thoại');
        }
    };

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
                            {/* New Chat button */}
                            <button
                                onClick={handleNewChat}
                                className="text-blue-100 p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
                                title="Hội thoại mới"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                            {/* History / Conversation list button */}
                            <button
                                onClick={() => setShowConversations(!showConversations)}
                                className={`text-blue-100 p-1.5 rounded-lg transition-colors ${showConversations ? 'bg-white/20 text-white' : 'hover:bg-white/10 hover:text-white'}`}
                                title="Lịch sử hội thoại"
                            >
                                <Clock className="h-4 w-4" />
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
                                onClick={handleExportReport}
                                disabled={isExporting}
                                className="text-blue-100 p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                                title="Xuất báo cáo tiến độ (DOCX)"
                            >
                                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
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

                    {/* Conversation List Panel (Phase 4) */}
                    {showConversations && (
                        <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200 max-h-52 overflow-y-auto">
                            <div className="p-2 flex items-center justify-between border-b border-gray-100">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lịch sử hội thoại</span>
                                {isLoadingConversations && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
                            </div>
                            {conversations.length === 0 && !isLoadingConversations ? (
                                <p className="text-xs text-gray-400 p-3 text-center">Chưa có hội thoại nào</p>
                            ) : (
                                conversations.map(conv => (
                                    <div
                                        key={conv.id}
                                        onClick={() => loadConversationMessages(conv.id)}
                                        className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors group ${
                                            currentConversationId === conv.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <MessageSquare className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                            <span className="text-xs text-gray-700 truncate">{conv.title}</span>
                                        </div>
                                        <button
                                            onClick={(e) => handleDeleteConversation(conv.id, e)}
                                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-1 flex-shrink-0 transition-opacity"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

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
