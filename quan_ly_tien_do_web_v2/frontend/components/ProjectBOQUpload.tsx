"use client";

import React, { useState } from 'react';
import { uploadProjectBOQ } from '@/lib/api';
import { Upload, X, FileSpreadsheet, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProjectBOQUploadProps {
    projectId: number;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ProjectBOQUpload({ projectId, isOpen, onClose, onSuccess }: ProjectBOQUploadProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<{ count: number; total: number } | null>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setResult(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        try {
            setIsUploading(true);
            const res = await uploadProjectBOQ(projectId, file);
            setResult({ count: res.count, total: res.total_contract });
            toast.success(`Đã cập nhật ${res.count} hạng mục BOQ dự án!`);
            onSuccess();
        } catch (error: any) {
            console.error('Upload Error:', error);
            const msg = error.response?.data?.detail || 'Lỗi khi upload BOQ';
            toast.error(msg);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                        Cập nhật BOQ Dự án
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-lg transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6">
                    {!result ? (
                        <>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Chọn file Excel (.xls, .xlsx)</label>
                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-green-400 hover:bg-green-50/50 transition-colors">
                                    <div className="space-y-2 text-center">
                                        <Upload className="mx-auto h-10 w-10 text-gray-400" />
                                        <div className="flex text-sm text-gray-600 justify-center">
                                            <label className="relative cursor-pointer rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-green-500">
                                                <span>Tải file lên</span>
                                                <input type="file" className="sr-only" accept=".xls,.xlsx" onChange={handleFileChange} />
                                            </label>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            {file ? file.name : "Kéo thả hoặc click để chọn"}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-3 text-xs text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                    <strong>Cột bắt buộc:</strong> Nội dung công việc<br />
                                    <strong>Cột tùy chọn:</strong> TT, ĐVT, KL Tkế, Đơn giá
                                </div>
                            </div>

                            <button
                                onClick={handleUpload}
                                disabled={!file || isUploading}
                                className={`w-full py-2.5 px-4 rounded-xl text-white font-medium flex justify-center items-center gap-2 transition-all ${!file || isUploading ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 shadow-md hover:shadow-lg active:scale-[0.98]'
                                    }`}
                            >
                                {isUploading ? (
                                    <><Loader2 className="h-5 w-5 animate-spin" /> Đang xử lý...</>
                                ) : (
                                    <>Xác nhận Upload</>
                                )}
                            </button>
                        </>
                    ) : (
                        <div className="text-center py-6">
                            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                                <CheckCircle2 className="h-10 w-10 text-green-600" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Thành công!</h3>
                            <p className="text-gray-500 text-sm mb-4">
                                Đã cật nhật <strong>{result.count}</strong> hạng mục công việc.<br />
                                Tổng giá trị hợp đồng: <strong>{result.total.toLocaleString('en-US')}</strong> VND.
                            </p>
                            <button
                                onClick={onClose}
                                className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition-colors"
                            >
                                Đóng
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
