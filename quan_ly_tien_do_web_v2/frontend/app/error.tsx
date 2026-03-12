'use client'; // Error components must be Client Components

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Global Application Error:', error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50 text-gray-900">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center border border-red-100">
                <h2 className="text-2xl font-bold text-red-600 mb-4">Đã xảy ra lỗi hệ thống!</h2>
                <p className="text-gray-600 mb-6 text-sm">
                    {error.message || 'Hệ thống vừa gặp sự cố không mong muốn. Vui lòng thử tải lại trang.'}
                </p>
                <div className="flex justify-center space-x-4">
                    <button
                        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                        onClick={
                            // Attempt to recover by trying to re-render the segment
                            () => reset()
                        }
                    >
                        Thử lại
                    </button>
                    <a
                        href="/"
                        className="px-6 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition block text-center"
                    >
                        Về trang chủ
                    </a>
                </div>
            </div>
        </div>
    );
}
