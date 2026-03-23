"use client";

import React, { useState, useCallback } from "react";
import useSWR from "swr";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StallItem {
  name: string;
  stall_days: number | null;
  category: string;
}

interface RiskItem {
  id: string;
  level: "CRITICAL" | "WARNING" | "INFO";
  icon: string;
  project: string;
  project_id: number | null;
  type: string;
  weight_score: number;
  message: string;
  detail: string;
  action_suggestion: string;
  stall_items?: StallItem[];
}

interface RiskAnalysisResponse {
  risks: RiskItem[];
  top_risks: RiskItem[];
  total: number;
  critical: number;
  warning: number;
  info: number;
  has_critical: boolean;
  summary: string;
  generated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const fetcher = (url: string) =>
  fetch(url, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
    },
  }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<RiskAnalysisResponse>;
  });

const LEVEL_STYLES: Record<string, { bg: string; border: string; badge: string; bar: string }> = {
  CRITICAL: {
    bg: "bg-red-950/40",
    border: "border-red-500/60",
    badge: "bg-red-500/20 text-red-300 border border-red-500/40",
    bar: "bg-red-500",
  },
  WARNING: {
    bg: "bg-amber-950/40",
    border: "border-amber-500/60",
    badge: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
    bar: "bg-amber-400",
  },
  INFO: {
    bg: "bg-blue-950/40",
    border: "border-blue-500/60",
    badge: "bg-blue-500/20 text-blue-300 border border-blue-500/40",
    bar: "bg-blue-400",
  },
};

const TYPE_LABELS: Record<string, string> = {
  schedule_delay: "Tiến độ",
  boq_overrun: "BOQ",
  financial_lag: "Tài chính",
  kanban_backlog: "Kanban",
  blocks_stalled: "Blocks",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function WeightBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            score >= 70 ? "bg-red-500" : score >= 40 ? "bg-amber-400" : "bg-blue-400"
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs text-white/50 w-8 text-right">{score}</span>
    </div>
  );
}

function RiskCard({ risk, expanded, onToggle }: { risk: RiskItem; expanded: boolean; onToggle: () => void }) {
  const s = LEVEL_STYLES[risk.level] ?? LEVEL_STYLES.INFO;

  return (
    <div
      className={`rounded-xl border ${s.bg} ${s.border} p-4 cursor-pointer transition-all duration-200 hover:brightness-110`}
      onClick={onToggle}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none mt-0.5">{risk.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.badge}`}>
              {risk.level}
            </span>
            <span className="text-xs text-white/50 bg-white/5 px-2 py-0.5 rounded-full">
              {TYPE_LABELS[risk.type] ?? risk.type}
            </span>
            <span className="text-xs text-white/40 truncate">{risk.project}</span>
          </div>
          <p className="text-sm text-white/90 mt-1 leading-snug">{risk.message}</p>
          <WeightBar score={risk.weight_score} />
        </div>
        <span className="text-white/30 text-xs mt-1">{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="mt-3 pl-9 space-y-2 border-t border-white/10 pt-3">
          <p className="text-xs text-white/60 leading-relaxed">
            <span className="text-white/40">Chi tiết: </span>
            {risk.detail}
          </p>
          <p className="text-xs text-emerald-300 leading-relaxed">
            <span className="text-white/40">💡 Đề xuất: </span>
            {risk.action_suggestion}
          </p>

          {/* Stall items sub-table */}
          {risk.stall_items && risk.stall_items.length > 0 && (
            <div className="mt-2 rounded-lg overflow-hidden border border-white/10">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/5 text-white/40">
                    <th className="px-3 py-1.5 text-left font-medium">Block</th>
                    <th className="px-3 py-1.5 text-left font-medium">Loại</th>
                    <th className="px-3 py-1.5 text-right font-medium">Ngày đình trệ</th>
                  </tr>
                </thead>
                <tbody>
                  {risk.stall_items.map((item, idx) => (
                    <tr key={idx} className="border-t border-white/5 hover:bg-white/5">
                      <td className="px-3 py-1.5 text-white/80 truncate max-w-[140px]">{item.name}</td>
                      <td className="px-3 py-1.5 text-white/50">{item.category || "—"}</td>
                      <td className="px-3 py-1.5 text-right">
                        {item.stall_days != null ? (
                          <span
                            className={`font-semibold ${
                              item.stall_days >= 14
                                ? "text-red-400"
                                : item.stall_days >= 7
                                ? "text-amber-400"
                                : "text-white/60"
                            }`}
                          >
                            {item.stall_days}d
                          </span>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryBadge({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className={`flex flex-col items-center px-4 py-2 rounded-xl ${color}`}>
      <span className="text-2xl font-bold">{count}</span>
      <span className="text-xs opacity-70 mt-0.5">{label}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface RiskDashboardProps {
  projectId?: number;
  /** Nếu true thì chỉ hiển thị top_risks (compact mode) */
  compact?: boolean;
}

export default function RiskDashboard({ projectId, compact = false }: RiskDashboardProps) {
  const url =
    `${API_BASE}/ai/risk-analysis` +
    (projectId ? `?project_id=${projectId}` : "");

  const { data, error, isLoading, mutate } = useSWR<RiskAnalysisResponse>(url, fetcher, {
    refreshInterval: 5 * 60 * 1000, // auto-refresh mỗi 5 phút
    revalidateOnFocus: false,
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const toggle = useCallback(
    (id: string) => setExpandedId((prev) => (prev === id ? null : id)),
    []
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6 animate-pulse space-y-3">
        <div className="h-5 bg-white/10 rounded w-1/3" />
        <div className="h-3 bg-white/10 rounded w-2/3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-2xl bg-red-950/30 border border-red-500/30 p-5 text-sm text-red-300 flex items-center gap-3">
        <span className="text-xl">⚠️</span>
        <div>
          <p className="font-semibold">Không thể tải phân tích rủi ro</p>
          <p className="text-xs opacity-70 mt-1">{(error as Error).message}</p>
        </div>
        <button
          onClick={() => mutate()}
          className="ml-auto text-xs border border-red-500/40 px-3 py-1 rounded-lg hover:bg-red-500/20 transition"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!data) return null;

  const displayRisks = compact
    ? data.top_risks
    : showAll
    ? data.risks
    : data.risks.slice(0, 5);

  const generatedTime = new Date(data.generated_at).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
      {/* ── Title bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🛡️</span>
          <h2 className="text-base font-semibold text-white">
            {compact ? "Top rủi ro" : "Phân tích rủi ro tự động"}
          </h2>
          {data.has_critical && (
            <span className="inline-flex items-center gap-1 text-xs bg-red-500/20 text-red-300 border border-red-500/40 px-2 py-0.5 rounded-full animate-pulse">
              🔴 CRITICAL
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-white/30">
          <span>Cập nhật {generatedTime}</span>
          <button
            onClick={() => mutate()}
            title="Làm mới"
            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/10 transition"
          >
            🔄
          </button>
        </div>
      </div>

      {/* ── Summary badges ────────────────────────────────────────────────── */}
      {!compact && (
        <div className="flex gap-2 flex-wrap">
          <SummaryBadge
            count={data.critical}
            label="Nghiêm trọng"
            color="bg-red-500/10 text-red-400 border border-red-500/20"
          />
          <SummaryBadge
            count={data.warning}
            label="Cảnh báo"
            color="bg-amber-500/10 text-amber-400 border border-amber-500/20"
          />
          <SummaryBadge
            count={data.info}
            label="Thông tin"
            color="bg-blue-500/10 text-blue-400 border border-blue-500/20"
          />
          <div className="flex-1 flex items-center px-3 py-2 rounded-xl bg-white/5 text-xs text-white/60">
            {data.summary}
          </div>
        </div>
      )}

      {/* ── Risk list ─────────────────────────────────────────────────────── */}
      {data.total === 0 ? (
        <div className="flex flex-col items-center py-8 text-white/40 gap-2">
          <span className="text-4xl">✅</span>
          <p className="text-sm">Không phát hiện rủi ro đáng kể</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayRisks.map((risk) => (
            <RiskCard
              key={risk.id}
              risk={risk}
              expanded={expandedId === risk.id}
              onToggle={() => toggle(risk.id)}
            />
          ))}
        </div>
      )}

      {/* ── Show more / less ──────────────────────────────────────────────── */}
      {!compact && data.total > 5 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="w-full py-2 text-xs text-white/40 hover:text-white/70 border border-white/10 rounded-xl hover:bg-white/5 transition"
        >
          {showAll ? "▲ Thu gọn" : `▼ Xem thêm ${data.total - 5} rủi ro`}
        </button>
      )}
    </div>
  );
}
