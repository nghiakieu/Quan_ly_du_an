import React, { useState, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BoxObject {
    id: string;
    label: string;
    status?: string;
    [key: string]: any;
}

interface ComponentTypeConfig {
    enabled: boolean;
    reportLevel: 'batch' | 'group'; // batch = count individual blocks; group = count completed components
}

interface GroupInfo {
    groupCode: string;    // e.g. "shaft.P37R"
    typeName: string;     // e.g. "shaft"
    name: string;         // e.g. "P37R"
    batches: BoxObject[]; // all objects belonging to this group
}

interface ComponentSummary {
    typeName: string;
    label: string;
    groups: GroupInfo[];
    completedGroups: number;  // groups where ALL batches = completed
    totalGroups: number;
    completedBatches: number; // total completed batch objects
    totalBatches: number;
}

// ─── Type label mapping ───────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
    shaft: 'Thân trụ',
    footing: 'Bệ móng',
    pile: 'Cọc khoan nhồi',
    cap: 'Xà mũ',
    beam: 'Dầm',
    deck: 'Bản mặt cầu',
    railing: 'Lan can',
    bearing: 'Gối cầu',
    joint: 'Khe co giãn',
};

// ─── ID Parser ────────────────────────────────────────────────────────────────

function parseObjectId(id: string): { type: string; name: string; batch: string | null } | null {
    // Expected format: {type}.{name}[.d{N}] or {type}.{name}
    // e.g. "shaft.P37R.d1", "footing.P37R", "beam.N1"
    const parts = id.split('.');
    if (parts.length < 2) return null;

    const type = parts[0];
    // Check if last part is a batch indicator (d1, d2, d3...)
    const lastPart = parts[parts.length - 1];
    const isBatch = /^d\d+$/i.test(lastPart);

    if (isBatch && parts.length >= 3) {
        const name = parts.slice(1, -1).join('.');
        return { type, name, batch: lastPart };
    } else {
        const name = parts.slice(1).join('.');
        return { type, name, batch: null };
    }
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ProgressDashboardProps {
    objects: BoxObject[];
}

const ProgressDashboard: React.FC<ProgressDashboardProps> = ({ objects }) => {
    const [showConfig, setShowConfig] = useState(false);
    const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
    const [typeConfigs, setTypeConfigs] = useState<Record<string, ComponentTypeConfig>>({});

    // ── Parse all objects with valid IDs ──────────────────────────────────────
    const summaries = useMemo(() => {
        // Group objects by type + name (= group_code)
        const groupMap = new Map<string, GroupInfo>();

        objects.forEach(obj => {
            const parsed = parseObjectId(obj.id);
            if (!parsed) return;

            const { type, name } = parsed;
            const groupCode = `${type}.${name}`;

            if (!groupMap.has(groupCode)) {
                groupMap.set(groupCode, { groupCode, typeName: type, name, batches: [] });
            }
            groupMap.get(groupCode)!.batches.push(obj);
        });

        // Aggregate groups by type
        const typeMap = new Map<string, GroupInfo[]>();
        groupMap.forEach(group => {
            const { typeName } = group;
            if (!typeMap.has(typeName)) typeMap.set(typeName, []);
            typeMap.get(typeName)!.push(group);
        });

        // Build summaries
        const result: ComponentSummary[] = [];
        typeMap.forEach((groups, typeName) => {
            let completedGroups = 0;
            let completedBatches = 0;
            let totalBatches = 0;

            groups.forEach(group => {
                const allDone = group.batches.every(b => b.status === 'completed');
                if (allDone) completedGroups++;
                completedBatches += group.batches.filter(b => b.status === 'completed').length;
                totalBatches += group.batches.length;
            });

            result.push({
                typeName,
                label: TYPE_LABELS[typeName] || typeName,
                groups,
                completedGroups,
                totalGroups: groups.length,
                completedBatches,
                totalBatches,
            });
        });

        // Sort by label
        result.sort((a, b) => a.label.localeCompare(b.label));
        return result;
    }, [objects]);

    const enabledSummaries = summaries.filter(s => {
        const cfg = typeConfigs[s.typeName];
        return cfg?.enabled !== false; // default: enabled
    });

    const toggleExpand = (typeName: string) => {
        setExpandedTypes(prev => {
            const next = new Set(prev);
            if (next.has(typeName)) next.delete(typeName); else next.add(typeName);
            return next;
        });
    };

    const toggleEnabled = (typeName: string) => {
        setTypeConfigs(prev => ({
            ...prev,
            [typeName]: {
                ...prev[typeName],
                enabled: prev[typeName]?.enabled === false ? true : false,
                reportLevel: prev[typeName]?.reportLevel ?? 'group',
            },
        }));
    };

    const setReportLevel = (typeName: string, level: 'batch' | 'group') => {
        setTypeConfigs(prev => ({
            ...prev,
            [typeName]: { ...prev[typeName], enabled: true, reportLevel: level },
        }));
    };

    if (summaries.length === 0) {
        return (
            <div className="mt-2 p-2 bg-gray-50 rounded border border-dashed border-gray-300 text-center text-[10px] text-gray-400">
                Đặt ID theo format <span className="font-mono">shaft.P37R.d1</span> để xem báo cáo
            </div>
        );
    }

    return (
        <div className="mt-2 border-t pt-2">
            {/* Header */}
            <div className="flex justify-between items-center mb-1.5">
                <h3 className="text-xs font-bold text-gray-700 flex items-center gap-1">
                    <span>📊</span> Tiến độ Thực hiện
                </h3>
                <button
                    onClick={() => setShowConfig(!showConfig)}
                    className={`p-1 rounded text-gray-500 hover:bg-gray-100 transition-colors ${showConfig ? 'bg-gray-100 text-gray-800' : ''}`}
                    title="Cài đặt báo cáo"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                </button>
            </div>

            {/* Config Panel */}
            {showConfig && (
                <div className="mb-2 p-2 bg-blue-50 rounded border border-blue-100 text-[10px] space-y-1.5">
                    <p className="font-semibold text-blue-800 mb-1">Hiển thị / Cấp báo cáo:</p>
                    {summaries.map(s => {
                        const cfg = typeConfigs[s.typeName];
                        const enabled = cfg?.enabled !== false;
                        const level = cfg?.reportLevel ?? 'group';
                        return (
                            <div key={s.typeName} className="flex items-center justify-between gap-1">
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={enabled}
                                        onChange={() => toggleEnabled(s.typeName)}
                                        className="w-3 h-3"
                                    />
                                    <span className={enabled ? 'text-gray-800' : 'text-gray-400'}>{s.label}</span>
                                </label>
                                {enabled && (
                                    <select
                                        value={level}
                                        onChange={e => setReportLevel(s.typeName, e.target.value as 'batch' | 'group')}
                                        className="text-[10px] border rounded px-1 py-0.5 bg-white"
                                    >
                                        <option value="group">Cấu kiện</option>
                                        <option value="batch">Đợt</option>
                                    </select>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Summary Rows */}
            <div className="space-y-1">
                {enabledSummaries.map(s => {
                    const cfg = typeConfigs[s.typeName];
                    const level = cfg?.reportLevel ?? 'group';
                    const isGroup = level === 'group';

                    const done = isGroup ? s.completedGroups : s.completedBatches;
                    const total = isGroup ? s.totalGroups : s.totalBatches;
                    const pct = total > 0 ? (done / total) * 100 : 0;
                    const isAllDone = done === total && total > 0;
                    const isExpanded = expandedTypes.has(s.typeName);

                    return (
                        <div key={s.typeName} className="text-[10px]">
                            {/* Summary Row */}
                            <button
                                onClick={() => toggleExpand(s.typeName)}
                                className="w-full flex items-center gap-1.5 hover:bg-gray-50 rounded px-1 py-0.5 transition-colors text-left"
                            >
                                {/* Expand icon */}
                                <span className="text-gray-400 w-2 flex-shrink-0">
                                    {isExpanded ? '▼' : '▶'}
                                </span>

                                {/* Label */}
                                <span className="w-16 flex-shrink-0 text-gray-700 font-medium truncate">{s.label}</span>

                                {/* Progress bar */}
                                <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-300 ${isAllDone ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : 'bg-gray-300'}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>

                                {/* Count */}
                                <span className={`flex-shrink-0 font-semibold ${isAllDone ? 'text-emerald-600' : 'text-gray-600'}`}>
                                    {done}/{total}
                                </span>

                                {/* Status icon */}
                                <span className="flex-shrink-0 w-3">
                                    {isAllDone ? '✅' : done > 0 ? '🔄' : ''}
                                </span>
                            </button>

                            {/* Drill-down detail */}
                            {isExpanded && (
                                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-gray-200 pl-2">
                                    {s.groups.map(group => {
                                        const gDone = group.batches.filter(b => b.status === 'completed').length;
                                        const gTotal = group.batches.length;
                                        const gPct = gTotal > 0 ? (gDone / gTotal) * 100 : 0;
                                        const gAllDone = gDone === gTotal && gTotal > 0;

                                        return (
                                            <div key={group.groupCode} className="flex items-center gap-1.5 px-1 py-0.5">
                                                <span className="w-12 flex-shrink-0 text-gray-600 truncate font-mono" title={group.name}>{group.name}</span>
                                                <div className="flex-1 bg-gray-200 rounded-full h-1 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${gAllDone ? 'bg-emerald-500' : gPct > 0 ? 'bg-blue-400' : 'bg-gray-300'}`}
                                                        style={{ width: `${gPct}%` }}
                                                    />
                                                </div>
                                                <span className={`flex-shrink-0 ${gAllDone ? 'text-emerald-600 font-semibold' : 'text-gray-500'}`}>
                                                    {gDone}/{gTotal}đợt
                                                </span>
                                                <span className="w-3 flex-shrink-0">
                                                    {gAllDone ? '✅' : gDone > 0 ? '🔄' : '⬜'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Hint footer */}
            <div className="mt-2 text-[9px] text-gray-400 border-t pt-1">
                ID format: <span className="font-mono">shaft.P37R.d1</span>
            </div>
        </div>
    );
};

export default ProgressDashboard;
