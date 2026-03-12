"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Project, DiagramSummary } from '@/lib/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface ProjectDashboardProps {
  project: Project;
}

const formatCurrency = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} Tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} Tr`;
  return new Intl.NumberFormat('vi-VN').format(value);
};

const COLORS = {
  design:    { fill: '#93c5fd', name: 'Sản lượng Thiết kế' },
  actual:    { fill: '#3b82f6', name: 'Sản lượng Thực hiện' },
  plan:      { fill: '#fbbf24', name: 'Sản lượng Kế hoạch' },
  remaining: { fill: '#f87171', name: 'Sản lượng Còn lại' },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-3 min-w-[200px]">
      <p className="font-semibold text-gray-800 text-sm mb-2 truncate max-w-[220px]">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs py-0.5">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: entry.fill }} />
          <span className="text-gray-600 flex-1">{entry.name}</span>
          <span className="font-medium text-gray-800">{formatCurrency(Number(entry.value))}</span>
        </div>
      ))}
    </div>
  );
};

export default function ProjectDashboard({ project }: ProjectDashboardProps) {
  // Tổng sản lượng cả dự án
  const totalDesign = project.total_budget ||
    project.diagrams.reduce((acc, d) => acc + (d.cached_target_value || 0), 0);
  const totalActual = project.cached_completed_value ||
    project.diagrams.reduce((acc, d) => acc + (d.cached_completed_value || 0), 0);
  const totalPlan = project.diagrams.reduce((acc, d) => acc + (d.cached_plan_value || 0), 0);
  const totalRemaining = Math.max(0, totalDesign - totalActual);

  // Biểu đồ tổng dự án (1 nhóm cột)
  const projectTotalData = [
    {
      name: 'Toàn dự án',
      design: totalDesign,
      actual: totalActual,
      plan: totalPlan,
      remaining: totalRemaining,
    }
  ];

  // Biểu đồ từng công trình
  const diagramData = project.diagrams.map((d: DiagramSummary) => {
    const design    = d.cached_target_value || 0;
    const actual    = d.cached_completed_value || 0;
    const plan      = d.cached_plan_value || 0;
    const remaining = Math.max(0, design - actual);
    return { name: d.name, design, actual, plan, remaining };
  });

  const commonBarProps = { radius: [4, 4, 0, 0] as [number,number,number,number], maxBarSize: 48 };

  return (
    <div className="space-y-6 mb-8">
      {/* --- Biểu đồ tổng quan cả dự án --- */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50 border-b border-slate-100 rounded-t-xl pb-3 pt-4">
          <CardTitle className="text-base font-semibold text-slate-800">
            📊 Biểu đồ Sản lượng Tổng dự án
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5 pb-4">
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectTotalData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={formatCurrency} width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={32} iconType="square" iconSize={12}
                  formatter={(v) => <span style={{ fontSize: 12, color: '#374151' }}>{COLORS[v as keyof typeof COLORS]?.name ?? v}</span>} />
                <Bar dataKey="design"    name="design"    fill={COLORS.design.fill}    {...commonBarProps} />
                <Bar dataKey="actual"    name="actual"    fill={COLORS.actual.fill}    {...commonBarProps} />
                <Bar dataKey="plan"      name="plan"      fill={COLORS.plan.fill}      {...commonBarProps} />
                <Bar dataKey="remaining" name="remaining" fill={COLORS.remaining.fill} {...commonBarProps} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Summary row */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            {[
              { label: 'Thiết kế',  value: totalDesign,    color: COLORS.design.fill    },
              { label: 'Thực hiện', value: totalActual,    color: COLORS.actual.fill    },
              { label: 'Kế hoạch',  value: totalPlan,      color: COLORS.plan.fill      },
              { label: 'Còn lại',   value: totalRemaining, color: COLORS.remaining.fill },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex flex-col items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="w-3 h-3 rounded-sm mb-1.5" style={{ background: color }} />
                <span className="text-xs text-gray-500 mb-1">{label}</span>
                <span className="text-sm font-bold text-gray-800">{formatCurrency(value)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* --- Biểu đồ từng công trình --- */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50 border-b border-slate-100 rounded-t-xl pb-3 pt-4">
          <CardTitle className="text-base font-semibold text-slate-800">
            📊 Biểu đồ Sản lượng theo Công trình
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5 pb-4">
          {diagramData.length > 0 ? (
            <div
              className="w-full overflow-x-auto"
              style={{ minHeight: 260 }}
            >
              <div style={{ minWidth: diagramData.length * 120 + 80, height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={diagramData} margin={{ top: 5, right: 20, left: 10, bottom: 35 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6b7280', fontSize: 11 }}
                      angle={-25}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={formatCurrency} width={70} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="top" height={32} iconType="square" iconSize={12}
                      formatter={(v) => <span style={{ fontSize: 12, color: '#374151' }}>{COLORS[v as keyof typeof COLORS]?.name ?? v}</span>} />
                    <Bar dataKey="design"    name="design"    fill={COLORS.design.fill}    {...commonBarProps} />
                    <Bar dataKey="actual"    name="actual"    fill={COLORS.actual.fill}    {...commonBarProps} />
                    <Bar dataKey="plan"      name="plan"      fill={COLORS.plan.fill}      {...commonBarProps} />
                    <Bar dataKey="remaining" name="remaining" fill={COLORS.remaining.fill} {...commonBarProps} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-slate-500 italic text-sm">
              Dự án chưa có công trình/hạng mục nào.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
