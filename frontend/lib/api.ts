import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api/v1';

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add Interceptor for JWT
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// TypeScript interfaces
export interface Block {
    id: number;
    code: string;
    category_name: string;
    pier?: string;
    span?: string;
    segment?: string;
    volume?: number;
    unit?: string;
    unit_price?: number;
    total_value?: number;
    status: number; // 0: Chưa, 1: Đang, 2: Xong
    completed_at?: string;
    notes?: string;
}

export interface Stats {
    total_blocks: number;
    completed: number;
    in_progress: number;
    not_started: number;
    progress_percent: number;
    total_value: number;
    completed_value: number;
}

export interface UploadResponse {
    status: string;
    message: string;
    new_count?: number;
    updated_count?: number;
}

// API functions
export const getBlocks = async (params?: {
    skip?: number;
    limit?: number;
}): Promise<Block[]> => {
    const response = await api.get('/blocks/', { params });
    return response.data;
};

export const getStats = async (): Promise<Stats> => {
    const response = await api.get('/blocks/stats');
    return response.data;
};

export async function getConfig() {
    const response = await api.get('/config');
    return response.data;
}

export async function saveConfig(config: any) {
    const response = await api.post('/config', config);
    return response.data;
}

export const uploadExcel = async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/blocks/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const clearAllData = async (): Promise<{ message: string }> => {
    const response = await api.delete('/blocks/');
    return response.data;
};

export default api;
