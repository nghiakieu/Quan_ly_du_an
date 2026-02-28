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

// Handle 401 responses (expired/invalid token)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

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
    status: number; // 0: Chua, 1: Dang, 2: Xong
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

// v1.3: Diagram Summary (embedded in Project)
export interface DiagramSummary {
    id: number;
    name: string;
    description?: string;
    updated_at?: string;
}

// v1.3: Extended Project interface
export interface Project {
    id: number;
    name: string;
    description?: string;
    status: string;
    investor?: string;
    total_budget?: number;
    start_date?: string;
    end_date?: string;
    manager_id?: number;
    created_at: string;
    updated_at: string;
    diagrams: DiagramSummary[];
}

// v1.3: Project Progress
export interface ProjectProgress {
    project_id: number;
    total_blocks: number;
    completed: number;
    in_progress: number;
    not_started: number;
    progress_percent: number;
    diagram_count: number;
}

// v1.3: Diagram full interface
export interface Diagram {
    id: number;
    name: string;
    description?: string;
    project_id?: number;
    objects?: string;
    boq_data?: string;
    updated_at?: string;
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

// --- PROJECTS API ---
export const getProjects = async (): Promise<Project[]> => {
    const response = await api.get('/projects/');
    return response.data;
};

export const getProject = async (id: number | string): Promise<Project> => {
    const response = await api.get(`/projects/${id}`);
    return response.data;
};

export const getProjectProgress = async (id: number | string): Promise<ProjectProgress> => {
    const response = await api.get(`/projects/${id}/progress`);
    return response.data;
};

export const createProject = async (data: {
    name: string;
    description?: string;
    status?: string;
    investor?: string;
    total_budget?: number;
    start_date?: string;
    end_date?: string;
}): Promise<Project> => {
    const response = await api.post('/projects/', data);
    return response.data;
};

export const updateProject = async (id: number | string, data: {
    name?: string;
    description?: string;
    status?: string;
    investor?: string;
    total_budget?: number;
    start_date?: string;
    end_date?: string;
}): Promise<Project> => {
    const response = await api.put(`/projects/${id}`, data);
    return response.data;
};

export const deleteProject = async (id: number | string): Promise<{ message: string }> => {
    const response = await api.delete(`/projects/${id}`);
    return response.data;
};

// --- DIAGRAMS API ---
export const getDiagrams = async (projectId?: number): Promise<Diagram[]> => {
    const params = projectId ? { project_id: projectId } : {};
    const response = await api.get('/diagrams/', { params });
    return response.data;
};

export const getDiagram = async (id: number | string): Promise<Diagram> => {
    const response = await api.get(`/diagrams/${id}`);
    return response.data;
};

export const createDiagram = async (data: {
    name: string;
    description?: string;
    project_id?: number;
    objects: string;
    boq_data: string;
}): Promise<Diagram> => {
    const response = await api.post('/diagrams/', data);
    return response.data;
};

export const updateDiagram = async (id: number | string, data: {
    name?: string;
    description?: string;
    objects?: string;
    boq_data?: string;
}): Promise<Diagram> => {
    const response = await api.put(`/diagrams/${id}`, data);
    return response.data;
};

export const deleteDiagram = async (id: number | string): Promise<Diagram> => {
    const response = await api.delete(`/diagrams/${id}`);
    return response.data;
};

// --- PROJECT MEMBERS API ---
export interface ProjectMember {
    id: number;
    user_id: number;
    username: string;
    role: string; // "manager" | "editor" | "viewer"
    added_at?: string;
}

export interface UserInfo {
    id: number;
    username: string;
    email: string;
    role: string;
    is_active: boolean;
}

export const getProjectMembers = async (projectId: number | string): Promise<ProjectMember[]> => {
    const response = await api.get(`/projects/${projectId}/members`);
    return response.data;
};

export const addProjectMember = async (projectId: number | string, data: {
    user_id: number;
    role?: string;
}): Promise<ProjectMember> => {
    const response = await api.post(`/projects/${projectId}/members`, data);
    return response.data;
};

export const updateProjectMemberRole = async (
    projectId: number | string,
    memberId: number,
    role: string
): Promise<ProjectMember> => {
    const response = await api.put(`/projects/${projectId}/members/${memberId}`, { role });
    return response.data;
};

export const removeProjectMember = async (
    projectId: number | string,
    memberId: number
): Promise<{ message: string }> => {
    const response = await api.delete(`/projects/${projectId}/members/${memberId}`);
    return response.data;
};

export const getUsers = async (): Promise<UserInfo[]> => {
    const response = await api.get('/users/');
    return response.data;
};

export default api;
