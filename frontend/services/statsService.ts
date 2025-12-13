import { fetchWithAuth } from '../utils/fetchWithAuth';

export interface Manager {
    id: number;
    name: string;
    total_audios?: number;
    average_score?: number;
    category_scores?: Record<string, number>;
    category_counts?: Record<string, number>;
    criteria_scores?: Record<string, Record<string, number>>;
    talk_ratio?: {
        manager: number;
        customer: number;
    };
    average_duration?: number;
    category_mistakes?: Record<string, Record<string, number>>;
    client_complaints?: Record<string, number>;
    hours_assigned?: number;
    hours_used?: number;
    hours_remaining?: number;
}

export interface HistoryPoint {
    upload_date: string;
    overall_score: number;
}

export interface VolumeDataPoint {
    date: string;
    count: number;
    [managerName: string]: string | number;
}

export async function getManagersStats(period?: string, startDate?: string, endDate?: string): Promise<Manager[]> {
    try {
        const params = new URLSearchParams();
        if (period) params.append('period', period);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const url = `/api/managers/stats${params.toString() ? '?' + params.toString() : ''}`;

        const response = await fetchWithAuth(url, {
            method: 'GET',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Backend xatolik (${response.status}): ${errorText || response.statusText}`);
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

export async function getManagerHistory(managerId: number, period?: string, startDate?: string, endDate?: string): Promise<HistoryPoint[]> {
    try {
        const params = new URLSearchParams();
        if (period) params.append('period', period);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const url = `/api/managers/${managerId}/history${params.toString() ? '?' + params.toString() : ''}`;

        const response = await fetchWithAuth(url, {
            method: 'GET',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Backend xatolik (${response.status}): ${errorText || response.statusText}`);
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

export async function getVolumeStats(period?: string, startDate?: string, endDate?: string, managerIds?: number[]): Promise<VolumeDataPoint[]> {
    try {
        const params = new URLSearchParams();
        if (period) params.append('period', period);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (managerIds && managerIds.length > 0) {
            params.append('managerIds', managerIds.join(','));
        }

        const url = `/api/stats/volume${params.toString() ? '?' + params.toString() : ''}`;

        const response = await fetchWithAuth(url, {
            method: 'GET',
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Volume stats API error:', response.status, errorText);
            throw new Error(`Volume stats xatolik (${response.status}): ${errorText || response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error in getVolumeStats:', error);
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(`Backend serverga ulanib bo'lmadi. Server ${process.env.NEXT_PUBLIC_API_URL || ''} da ishlamoqdamimi tekshiring.`);
        }
        throw error;
    }
}

export interface AudioStats {
    file: {
        id: number;
        original_name: string;
        manager_name: string;
        upload_date: string;
        status: string;
    };
    overall_score: number;
    criteria_scores: Record<string, Record<string, number>>;
    category_mistakes: Record<string, Record<string, { count: number; recommendation?: string }>>;
    client_complaints: Record<string, number>;
    talk_ratio: {
        manager: number;
        customer: number;
    } | null;
    duration: number | null;
}

export async function getAudioStats(audioId: number): Promise<AudioStats> {
    try {
        const url = `/api/audio/${audioId}/stats`;

        const response = await fetchWithAuth(url, {
            method: 'GET',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Audio stats xatolik (${response.status}): ${errorText || response.statusText}`);
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
