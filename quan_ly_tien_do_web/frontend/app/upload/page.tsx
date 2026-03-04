"use client";

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { uploadExcel } from '@/lib/api';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function UploadPage() {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<{ status: string; message: string; new_count?: number; updated_count?: number } | null>(null);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const selectedFile = acceptedFiles[0];

            // Validate file type
            if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
                toast.error('Vui lòng chọn file Excel (.xlsx hoặc .xls)');
                return;
            }

            setFile(selectedFile);
            setResult(null);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls']
        },
        multiple: false
    });

    const handleUpload = async () => {
        if (!file) return;

        try {
            setUploading(true);
            const response = await uploadExcel(file);

            // Debug: Log response
            console.log('Upload response:', response);

            setResult(response);

            if (response.status === 'success') {
                toast.success(response.message);
                // Redirect to dashboard after 2 seconds
                setTimeout(() => {
                    router.push('/');
                }, 2000);
            } else {
                console.error('Upload failed with response:', response);
                toast.error(response.message || 'Upload thất bại');
            }
        } catch (error: any) {
            console.error('Upload error:', error);
            console.error('Error response:', error.response);

            const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Có lỗi xảy ra khi upload file';
            toast.error(errorMessage);
            setResult({ status: 'error', message: errorMessage });
        } finally {
            setUploading(false);
        }
    };

    const handleClear = () => {
        setFile(null);
        setResult(null);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Upload File Excel</h1>
                    <p className="text-gray-600 mt-2">Tải lên file dữ liệu tiến độ dự án</p>
                </div>

                {/* Upload Card */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Chọn File Excel</CardTitle>
                        <CardDescription>
                            Kéo thả file hoặc click để chọn file Excel (.xlsx, .xls)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {/* Dropzone */}
                        <div
                            {...getRootProps()}
                            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                                }`}
                        >
                            <input {...getInputProps()} />
                            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                            {isDragActive ? (
                                <p className="text-blue-600 font-medium">Thả file vào đây...</p>
                            ) : (
                                <div>
                                    <p className="text-gray-700 font-medium mb-2">
                                        Kéo thả file Excel vào đây
                                    </p>
                                    <p className="text-gray-500 text-sm">
                                        hoặc click để chọn file từ máy tính
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Selected File */}
                        {file && (
                            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                                    <div>
                                        <p className="font-medium text-gray-900">{file.name}</p>
                                        <p className="text-sm text-gray-600">
                                            {(file.size / 1024).toFixed(2)} KB
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleClear}
                                    disabled={uploading}
                                >
                                    Xóa
                                </Button>
                            </div>
                        )}

                        {/* Upload Button */}
                        {file && !result && (
                            <div className="mt-6">
                                <Button
                                    onClick={handleUpload}
                                    disabled={uploading}
                                    className="w-full"
                                    size="lg"
                                >
                                    {uploading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Đang upload...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="mr-2 h-4 w-4" />
                                            Upload File
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}

                        {/* Result */}
                        {result && (
                            <div className={`mt-6 p-4 rounded-lg ${result.status === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                                }`}>
                                <div className="flex items-start gap-3">
                                    {result.status === 'success' ? (
                                        <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                    ) : (
                                        <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                                    )}
                                    <div>
                                        <p className={`font-semibold ${result.status === 'success' ? 'text-green-900' : 'text-red-900'
                                            }`}>
                                            {result.status === 'success' ? 'Upload thành công!' : 'Upload thất bại'}
                                        </p>
                                        <p className={`text-sm mt-1 ${result.status === 'success' ? 'text-green-700' : 'text-red-700'
                                            }`}>
                                            {result.message}
                                        </p>
                                        {result.status === 'success' && (
                                            <div className="mt-2 text-sm text-green-700">
                                                <p>• Thêm mới: {result.new_count || 0} hạng mục</p>
                                                <p>• Cập nhật: {result.updated_count || 0} hạng mục</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Instructions */}
                <Card>
                    <CardHeader>
                        <CardTitle>Hướng Dẫn</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 text-sm text-gray-700">
                            <div className="flex gap-2">
                                <span className="font-semibold text-blue-600">1.</span>
                                <p>File Excel phải có cấu trúc chuẩn với các cột: Mã số, Loại hạng mục, Trụ, Nhịp, Đoạn, Khối lượng, Đơn vị, Đơn giá, Tổng giá trị, Trạng thái, Ghi chú</p>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold text-blue-600">2.</span>
                                <p>Hàng tiêu đề (header) phải ở dòng thứ 2 của file Excel</p>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold text-blue-600">3.</span>
                                <p>Trạng thái có thể nhập: "Chưa", "Đang", "Xong" (hoặc "Hoàn thành")</p>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold text-blue-600">4.</span>
                                <p>Nếu mã số đã tồn tại, hệ thống sẽ tự động cập nhật thông tin</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
