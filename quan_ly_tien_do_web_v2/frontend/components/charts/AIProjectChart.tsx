import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { api } from '@/lib/api';
import { Loader2, RefreshCw } from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, Legend
} from 'recharts';

interface AIProjectChartProps {
    projectId: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AIProjectChart({ projectId }: AIProjectChartProps) {
    const [charts, setCharts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchChartData = async () => {
        setLoading(true);
        setError(null);
        try {
            const apiKey = localStorage.getItem('user_gemini_api_key');
            const res = await api.post('/ai/chart-data', {
                project_id: projectId,
                api_key: apiKey || null
            });
            if (res.data && res.data.charts) {
                setCharts(res.data.charts);
            }
        } catch (err: any) {
            setError('Không thể tải dữ liệu biểu đồ AI. Vui lòng kiểm tra API Key.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchChartData();
    }, [projectId]);

    if (loading) {
        return (
            <Card className="shadow-md border-indigo-100 bg-indigo-50/30 mt-6">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
                    <p className="text-sm text-indigo-600 font-medium">AI đang phân tích và tạo biểu đồ...</p>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="shadow-md border-red-100 bg-red-50/30 mt-6">
                <CardContent className="flex flex-col items-center justify-center py-8">
                    <p className="text-sm text-red-500 mb-4">{error}</p>
                    <button onClick={fetchChartData} className="flex items-center gap-2 text-sm bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 text-gray-700 transition">
                        <RefreshCw className="h-4 w-4" /> Thử lại
                    </button>
                </CardContent>
            </Card>
        );
    }

    if (charts.length === 0) {
        return null;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {charts.map((chart, idx) => (
                <Card key={idx} className="shadow-md border-slate-200 overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-100 py-4">
                        <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <span className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">✨</span>
                            {chart.title}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                {chart.type === 'pie' ? (
                                    <PieChart>
                                        <Pie
                                            data={chart.data}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={true}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                            nameKey="name"
                                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {chart.data.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                ) : (
                                    <BarChart data={chart.data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                        <Bar dataKey="plan" name="Kế hoạch" fill="#93c5fd" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                        <Bar dataKey="actual" name="Thực tế" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                    </BarChart>
                                )}
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
