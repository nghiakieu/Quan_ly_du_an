"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';

interface CursorUser {
    userId: string;
    username: string;
    color: string;
    x: number;
    y: number;
}

const USER_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
];

function getColorForUser(username: string): string {
    let hash = 0;
    for (const ch of username) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
    return USER_COLORS[hash % USER_COLORS.length];
}

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8002';

export default function PresenceCursors({
    diagramId,
    containerRef,
}: {
    diagramId: number | string;
    containerRef: React.RefObject<HTMLElement | null>;
}) {
    const [remoteCursors, setRemoteCursors] = useState<Record<string, CursorUser>>({});
    const wsRef = useRef<WebSocket | null>(null);
    const { user } = useAuth();
    const username = user?.username || 'Ẩn danh';
    const myColor = getColorForUser(username);
    const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const connect = useCallback(() => {
        const wsUrl = `${WS_BASE}/api/v1/ws/diagram/${diagramId}?username=${encodeURIComponent(username)}&user_color=${encodeURIComponent(myColor)}`;
        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'cursor') {
                        setRemoteCursors(prev => ({
                            ...prev,
                            [msg.userId]: {
                                userId: msg.userId,
                                username: msg.username,
                                color: msg.color,
                                x: msg.x,
                                y: msg.y,
                            }
                        }));
                    } else if (msg.type === 'leave') {
                        setRemoteCursors(prev => {
                            const next = { ...prev };
                            delete next[msg.userId];
                            return next;
                        });
                    } else if (msg.type === 'presence_list') {
                        // Initial presence list on join - nothing to render until cursors move
                    }
                } catch { /* ignore parse errors */ }
            };

            ws.onclose = () => {
                // Auto-reconnect after 3s
                reconnectRef.current = setTimeout(connect, 3000);
            };

            ws.onerror = () => {
                ws.close();
            };
        } catch { /* WebSocket not available */ }
    }, [diagramId, username, myColor]);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
            wsRef.current?.close();
        };
    }, [connect]);

    // Track mouse movement over the diagram container
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (throttleRef.current) return;
            throttleRef.current = setTimeout(() => { throttleRef.current = null; }, 50);

            const rect = container.getBoundingClientRect();
            const x = Math.round(e.clientX - rect.left);
            const y = Math.round(e.clientY - rect.top);

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'cursor', x, y }));
            }
        };

        container.addEventListener('mousemove', handleMouseMove);
        return () => container.removeEventListener('mousemove', handleMouseMove);
    }, [containerRef]);

    // Render remote cursors as overlay
    const cursors = Object.values(remoteCursors);
    if (cursors.length === 0) return null;

    return (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
            {cursors.map((cursor) => (
                <div
                    key={cursor.userId}
                    className="absolute transition-all duration-75 ease-out"
                    style={{ left: cursor.x, top: cursor.y }}
                >
                    {/* Cursor SVG */}
                    <svg
                        width="20" height="20"
                        viewBox="0 0 20 20"
                        fill={cursor.color}
                        className="drop-shadow"
                    >
                        <path d="M0 0 L0 14 L4 10 L8 18 L10 17 L6 9 L12 9 Z" />
                    </svg>
                    {/* Username label */}
                    <div
                        className="absolute left-4 top-3 px-1.5 py-0.5 rounded text-white text-[10px] font-medium whitespace-nowrap shadow-sm"
                        style={{ background: cursor.color }}
                    >
                        {cursor.username}
                    </div>
                </div>
            ))}
        </div>
    );
}
