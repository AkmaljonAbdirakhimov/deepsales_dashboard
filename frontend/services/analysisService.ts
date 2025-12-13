import { fetchWithAuth } from '../utils/fetchWithAuth';

export async function analyzeFiles(fileIds: number[]): Promise<{ message: string; fileIds: number[] }> {
    try {
        const response = await fetchWithAuth('/api/analyze', {
            method: 'POST',
            body: JSON.stringify({ fileIds }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Tahlil xatolik (${response.status}): ${errorText || response.statusText}`);
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
