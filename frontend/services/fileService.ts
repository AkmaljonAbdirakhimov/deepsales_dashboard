import { fetchWithAuth } from '../utils/fetchWithAuth';

export interface UploadedFile {
    id: number;
    filename: string;
    manager: string;
    status: string;
}

export interface UploadResponse {
    message: string;
    files: UploadedFile[];
}

export interface AudioFile {
    id: number;
    filename: string;
    original_name: string;
    manager_id: number;
    manager_name: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    upload_date: string;
    transcription_id?: number;
    analysis_id?: number;
    overall_score?: number;
}

export async function uploadFiles(files: File[], managerIds: number[]): Promise<UploadResponse> {
    try {
        const formData = new FormData();

        // Append files
        files.forEach((file) => {
            formData.append('files', file);
        });

        // Append manager ids as JSON
        formData.append('managerIds', JSON.stringify(managerIds));

        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        const headers: HeadersInit = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/upload`, {
            method: 'POST',
            headers,
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Yuklash xatolik (${response.status}): ${errorText || response.statusText}`);
        }

        return response.json();
    } catch (error: any) {
        if (error.message === 'Unauthorized') {
            throw error;
        }
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(`Backend serverga ulanib bo'lmadi. Server ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'} da ishlamoqdamimi tekshiring.`);
        }
        throw error;
    }
}

export async function getFiles(): Promise<AudioFile[]> {
    try {
        const response = await fetchWithAuth('/api/files', {
            method: 'GET',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Fayllarni olishda xatolik (${response.status}): ${errorText || response.statusText}`);
        }

        return response.json();
    } catch (error: any) {
        if (error.message === 'Unauthorized') {
            throw error;
        }
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(`Backend serverga ulanib bo'lmadi. Server ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'} da ishlamoqdamimi tekshiring.`);
        }
        throw error;
    }
}

export async function getResults(id: number): Promise<{
    file: AudioFile;
    transcription: {
        id: number;
        audio_file_id: number;
        full_text: string;
        segments: Array<{
            speaker: 'manager' | 'client' | 'system' | string; // Allow string for backward compatibility
            text: string;
            timestamp: string;
        }>;
    } | null;
    analysis: any | null;
}> {
    try {
        const response = await fetchWithAuth(`/api/results/${id}`, {
            method: 'GET',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Natijalarni olishda xatolik (${response.status}): ${errorText || response.statusText}`);
        }

        return response.json();
    } catch (error: any) {
        if (error.message === 'Unauthorized') {
            throw error;
        }
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(`Backend serverga ulanib bo'lmadi. Server ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'} da ishlamoqdamimi tekshiring.`);
        }
        throw error;
    }
}

export async function deleteAudio(id: number): Promise<{ message: string }> {
    try {
        const response = await fetchWithAuth(`/api/files/${id}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`O'chirishda xatolik (${response.status}): ${errorText || response.statusText}`);
        }

        return response.json();
    } catch (error: any) {
        if (error.message === 'Unauthorized') {
            throw error;
        }
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(`Backend serverga ulanib bo'lmadi. Server ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'} da ishlamoqdamimi tekshiring.`);
        }
        throw error;
    }
}

export interface Manager {
    id: number;
    name: string;
    hours_assigned?: number;
    hours_used?: number;
    hours_remaining?: number;
}

export interface ManagerLimitInfo {
    allowed: boolean;
    current: number;
    max: number | null;
    message?: string;
    unlimited?: boolean;
}

export async function getManagers(): Promise<Manager[]> {
    try {
        const response = await fetchWithAuth('/api/managers', {
            method: 'GET',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Managerlarni olishda xatolik (${response.status}): ${errorText || response.statusText}`);
        }

        return response.json();
    } catch (error: any) {
        if (error.message === 'Unauthorized') {
            throw error;
        }
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(`Backend serverga ulanib bo'lmadi. Server ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'} da ishlamoqdamimi tekshiring.`);
        }
        throw error;
    }
}

export async function getManagerLimits(): Promise<ManagerLimitInfo> {
    try {
        const response = await fetchWithAuth('/api/managers/limits', {
            method: 'GET',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Manager limitni olishda xatolik (${response.status}): ${errorText || response.statusText}`);
        }

        return response.json();
    } catch (error: any) {
        if (error.message === 'Unauthorized') {
            throw error;
        }
        throw error;
    }
}

export async function createManager(name: string): Promise<Manager> {
    try {
        const response = await fetchWithAuth('/api/managers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Manager yaratishda xatolik (${response.status}): ${errorText || response.statusText}`);
        }

        return response.json();
    } catch (error: any) {
        if (error.message === 'Unauthorized') {
            throw error;
        }
        throw error;
    }
}

export async function updateManager(id: number, name: string): Promise<Manager> {
    try {
        const response = await fetchWithAuth(`/api/managers/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Managerni yangilashda xatolik (${response.status}): ${errorText || response.statusText}`);
        }

        return response.json();
    } catch (error: any) {
        if (error.message === 'Unauthorized') {
            throw error;
        }
        throw error;
    }
}

export async function deleteManager(id: number): Promise<{ message: string }> {
    try {
        const response = await fetchWithAuth(`/api/managers/${id}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Managerni o'chirishda xatolik (${response.status}): ${errorText || response.statusText}`);
        }

        return response.json();
    } catch (error: any) {
        if (error.message === 'Unauthorized') {
            throw error;
        }
        throw error;
    }
}

export async function retryAnalysis(fileId: number): Promise<{ message: string; fileIds: number[] }> {
    try {
        const response = await fetchWithAuth('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileIds: [fileId] }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Tahlilni qayta ishga tushirishda xatolik (${response.status}): ${errorText || response.statusText}`);
        }

        return response.json();
    } catch (error: any) {
        if (error.message === 'Unauthorized') {
            throw error;
        }
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(`Backend serverga ulanib bo'lmadi. Server ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'} da ishlamoqdamimi tekshiring.`);
        }
        throw error;
    }
}

export async function stopAnalysis(fileId: number): Promise<{ message: string; fileIds: number[] }> {
    try {
        const response = await fetchWithAuth('/api/analyze/stop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileIds: [fileId] }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Tahlilni to'xtatishda xatolik (${response.status}): ${errorText || response.statusText}`);
        }

        return response.json();
    } catch (error: any) {
        if (error.message === 'Unauthorized') {
            throw error;
        }
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(`Backend serverga ulanib bo'lmadi. Server ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'} da ishlamoqdamimi tekshiring.`);
        }
        throw error;
    }
}
