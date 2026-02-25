"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LayoutGrid, ArrowRight, FolderGit2 } from 'lucide-react';
import { getProjects, type Project } from '@/lib/api';

export default function DiagramIndex() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getProjects()
            .then(setProjects)
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    // Collect all diagrams across projects
    const allDiagrams = projects.flatMap(p =>
        (p.diagrams || []).map(d => ({ ...d, projectId: p.id, projectName: p.name }))
    );

    return (
        <div className="max-w-4xl mx-auto px-4 py-12">
            <div className="text-center mb-10">
                <LayoutGrid className="h-14 w-14 text-blue-500 mx-auto mb-3" />
                <h1 className="text-2xl font-bold text-gray-900">Sơ đồ Thi công</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Chọn một công trình bên dưới để mở sơ đồ thi công
                </p>
            </div>

            {loading ? (
                <div className="flex justify-center py-10">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : allDiagrams.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
                    <FolderGit2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 mb-3">Chưa có công trình nào</p>
                    <Link
                        href="/projects"
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        Vào Danh mục Dự án để tạo
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            ) : (
                <div className="space-y-3">
                    {allDiagrams.map((d) => (
                        <Link
                            key={d.id}
                            href={`/projects/${d.projectId}?diagram=${d.id}`}
                            className="group flex items-center justify-between bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md p-4 transition-all"
                        >
                            <div>
                                <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                                    {d.name}
                                </h3>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Dự án: {d.projectName}
                                </p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
