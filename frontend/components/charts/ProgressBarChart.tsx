"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ProgressBarChartProps {
    data: {
        name: string;
        completed: number;
        inProgress: number;
        notStarted: number;
    }[];
}

export default function ProgressBarChart({ data }: ProgressBarChartProps) {
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const total = payload.reduce((sum: number, item: any) => sum + item.value, 0);
            return (
                <div className="bg-white p-3 rounded-lg shadow-lg border">
                    <p className="font-semibold mb-2">{label}</p>
                    {payload.map((item: any, index: number) => (
                        <p key={index} className="text-sm" style={{ color: item.color }}>
                            {item.name}: {item.value}
                        </p>
                    ))}
                    <p className="text-sm font-semibold mt-1 pt-1 border-t">
                        Tổng: {total}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="completed" stackId="a" fill="#10b981" name="Hoàn thành" />
                <Bar dataKey="inProgress" stackId="a" fill="#f59e0b" name="Đang thực hiện" />
                <Bar dataKey="notStarted" stackId="a" fill="#ef4444" name="Chưa bắt đầu" />
            </BarChart>
        </ResponsiveContainer>
    );
}
