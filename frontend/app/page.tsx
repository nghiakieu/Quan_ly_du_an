"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import DonutChart from '@/components/charts/DonutChart';
import ProgressBarChart from '@/components/charts/ProgressBarChart';
import { getStats, getBlocks, type Stats, type Block } from '@/lib/api';
import { BarChart3, CheckCircle2, Clock, XCircle } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsData, blocksData] = await Promise.all([
        getStats(),
        getBlocks({ limit: 10 })
      ]);
      setStats(statsData);
      setBlocks(blocksData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const donutData = stats ? [
    { name: 'Chưa bắt đầu', value: stats.not_started },
    { name: 'Đang thực hiện', value: stats.in_progress },
    { name: 'Hoàn thành', value: stats.completed },
  ] : [];

  // Group blocks by pier for bar chart
  const barChartData = blocks.reduce((acc: any[], block) => {
    const pier = block.pier || 'Khác';
    const existing = acc.find(item => item.name === pier);

    if (existing) {
      if (block.status === 2) existing.completed++;
      else if (block.status === 1) existing.inProgress++;
      else existing.notStarted++;
    } else {
      acc.push({
        name: pier,
        completed: block.status === 2 ? 1 : 0,
        inProgress: block.status === 1 ? 1 : 0,
        notStarted: block.status === 0 ? 1 : 0,
      });
    }
    return acc;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Tiến Độ</h1>
          <p className="text-gray-600 mt-2">Tổng quan dự án và thống kê</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tổng Khối Lượng</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_blocks || 0}</div>
              <p className="text-xs text-muted-foreground">hạng mục</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hoàn Thành</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.completed || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.progress_percent.toFixed(1)}% tiến độ
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Đang Thực Hiện</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats?.in_progress || 0}</div>
              <p className="text-xs text-muted-foreground">công việc đang làm</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chưa Bắt Đầu</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats?.not_started || 0}</div>
              <p className="text-xs text-muted-foreground">cần triển khai</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Phân Bổ Trạng Thái</CardTitle>
              <CardDescription>Tỷ lệ công việc theo trạng thái</CardDescription>
            </CardHeader>
            <CardContent>
              <DonutChart data={donutData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tiến Độ Theo Trụ</CardTitle>
              <CardDescription>Chi tiết tiến độ từng trụ</CardDescription>
            </CardHeader>
            <CardContent>
              <ProgressBarChart data={barChartData} />
            </CardContent>
          </Card>
        </div>

        {/* Recent Updates */}
        <Card>
          <CardHeader>
            <CardTitle>Cập Nhật Gần Đây</CardTitle>
            <CardDescription>10 hạng mục mới nhất</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {blocks.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  Chưa có dữ liệu. Vui lòng upload file Excel.
                </p>
              ) : (
                blocks.map(block => (
                  <div key={block.id} className="flex items-center justify-between border-b pb-3">
                    <div>
                      <p className="font-semibold">{block.code}</p>
                      <p className="text-sm text-gray-600">{block.category_name}</p>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${block.status === 2 ? 'bg-green-100 text-green-800' :
                          block.status === 1 ? 'bg-amber-100 text-amber-800' :
                            'bg-red-100 text-red-800'
                        }`}>
                        {block.status === 2 ? 'Xong' : block.status === 1 ? 'Đang' : 'Chưa'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

