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
  const totalContract = project.total_budget ||
    project.diagrams.reduce((acc, d) => acc + (d.cached_target_value || 0), 0);
  const totalActual = project.cached_completed_value ||
    project.diagrams.reduce((acc, d) => acc + (d.cached_completed_value || 0), 0);
  const totalPlan = project.diagrams.reduce((acc, d) => acc + (d.cached_plan_value || 0), 0);
  const totalRemaining = Math.max(0, totalContract - totalActual);

  // Gộp dữ liệu "Toàn dự án" và các "Công trình"
  const unifiedData = [
    {
      name: 'TOÀN DỰ ÁN',
      contract: totalContract,
      actual: totalActual,
      plan: totalPlan,
      remaining: totalRemaining,
      isTotal: true,
    },
    ...project.diagrams.map((d: DiagramSummary) => {
      const contract = d.cached_target_value || 0;
      const actual = d.cached_completed_value || 0;
      const plan = d.cached_plan_value || 0;
      const remaining = Math.max(0, contract - actual);
      return { name: d.name, contract, actual, plan, remaining, isTotal: false };
    })
  ];

  const commonBarProps = { radius: [4, 4, 0, 0] as [number, number, number, number], maxBarSize: 40 };
  
  // Tính toán chiều rộng động: ít nhất 100%, nếu nhiều công trình thì mở rộng để cuộn
  const chartMinWidth = Math.max(100, unifiedData.length * 150);

  return (
    <div className="space-y-6 mb-8">
      <Card className="shadow-md border-slate-200 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 pb-4 pt-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">📊</span>
              Biểu đồ Sản lượng Tổng thể & Chi tiết
            </CardTitle>
            <div className="flex flex-wrap gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS.design.fill }} />
                <span className="text-slate-600">Giá trị hợp đồng</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS.actual.fill }} />
                <span className="text-slate-600">Giá trị thực hiện</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS.plan.fill }} />
                <span className="text-slate-600">Giá trị kế hoạch</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS.remaining.fill }} />
                <span className="text-slate-600">Giá trị Còn lại</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            <div style={{ minWidth: `${chartMinWidth}px`, height: '400px', padding: '24px 24px 40px 12px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={unifiedData} margin={{ top: 10, right: 30, left: 20, bottom: 60 }} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={(props) => {
                      const { x, y, payload } = props;
                      const isTotal = unifiedData[props.index]?.isTotal;
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text
                            x={0}
                            y={0}
                            dy={16}
                            textAnchor="end"
                            fill={isTotal ? '#1e40af' : '#64748b'}
                            fontSize={isTotal ? 12 : 11}
                            fontWeight={isTotal ? 700 : 500}
                            transform="rotate(-35)"
                          >
                            {payload.value}
                          </text>
                        </g>
                      );
                    }}
                    interval={0}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 11 }} 
                    tickFormatter={formatCurrency} 
                    width={80} 
                  />
                  <Tooltip 
                    content={<CustomTooltip />} 
                    cursor={{ fill: '#f8fafc', radius: 4 }}
                  />
                  <Bar dataKey="contract"  name="Giá trị hợp đồng" fill={COLORS.design.fill}    {...commonBarProps} />
                  <Bar dataKey="actual"    name="Giá trị thực hiện" fill={COLORS.actual.fill}    {...commonBarProps} />
                  <Bar dataKey="plan"      name="Giá trị kế hoạch" fill={COLORS.plan.fill}      {...commonBarProps} />
                  <Bar dataKey="remaining" name="Giá trị Còn lại"  fill={COLORS.remaining.fill} {...commonBarProps} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Legend Area - Quick Summary */}
          <div className="bg-slate-50/50 border-t border-slate-100 p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Tổng hợp đồng</span>
              <span className="text-base font-black text-slate-800">{formatCurrency(totalContract)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-blue-500 font-bold">Đã thực hiện</span>
              <span className="text-base font-black text-blue-700">{formatCurrency(totalActual)}</span>
              <div className="w-full h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                <div 
                  className="h-full bg-blue-500" 
                  style={{ width: `${Math.min(100, (totalActual/totalContract)*100)}%` }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-amber-500 font-bold">Theo kế hoạch</span>
              <span className="text-base font-black text-amber-600">{formatCurrency(totalPlan)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-rose-500 font-bold">Giá trị còn lại</span>
              <span className="text-base font-black text-rose-600">{formatCurrency(totalRemaining)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
