import { fetchWithAuth } from '../utils/fetchWithAuth';

export interface Category {
    id: number;
    name: string;
    created_at: string;
    criteria?: Criterion[];
}

export interface Criterion {
    id: number;
    category_id: number;
    name: string;
    description?: string;
    created_at: string;
}

export async function getCategories(): Promise<Category[]> {
    try {
        const response = await fetchWithAuth('/api/categories', {
            method: 'GET',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Kategoriyalarni olishda xatolik (${response.status}): ${errorText || response.statusText}`);
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

export async function createCategory(name: string): Promise<Category> {
    try {
        const response = await fetchWithAuth('/api/categories', {
            method: 'POST',
            body: JSON.stringify({ name }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Kategoriya yaratishda xatolik (${response.status}): ${errorText || response.statusText}`);
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

export async function updateCategory(id: number, name: string): Promise<Category> {
    try {
        const response = await fetchWithAuth(`/api/categories/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ name }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Kategoriyani yangilashda xatolik (${response.status}): ${errorText || response.statusText}`);
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

export async function deleteCategory(id: number): Promise<{ message: string }> {
    try {
        const response = await fetchWithAuth(`/api/categories/${id}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Kategoriyani o'chirishda xatolik (${response.status}): ${errorText || response.statusText}`);
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

export async function createCriterion(category_id: number, name: string, description?: string): Promise<Criterion> {
    try {
        const response = await fetchWithAuth('/api/criteria', {
            method: 'POST',
            body: JSON.stringify({ category_id, name, description }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Mezon yaratishda xatolik (${response.status}): ${errorText || response.statusText}`);
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

export async function updateCriterion(id: number, name: string, description?: string): Promise<Criterion> {
    try {
        const response = await fetchWithAuth(`/api/criteria/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ name, description }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Mezonni yangilashda xatolik (${response.status}): ${errorText || response.statusText}`);
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

export async function deleteCriterion(id: number): Promise<{ message: string }> {
    try {
        const response = await fetchWithAuth(`/api/criteria/${id}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Mezonni o'chirishda xatolik (${response.status}): ${errorText || response.statusText}`);
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
