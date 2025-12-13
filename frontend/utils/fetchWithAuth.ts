import { authService } from '../services/authService';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface FetchOptions extends RequestInit {
    requireAuth?: boolean;
}

/**
 * Fetch with automatic authentication header
 */
export async function fetchWithAuth(
    url: string,
    options: FetchOptions = {}
): Promise<Response> {
    const { requireAuth = true, headers = {}, ...restOptions } = options;

    const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers as Record<string, string>,
    };

    if (requireAuth) {
        const token = authService.getToken();
        if (token) {
            requestHeaders['Authorization'] = `Bearer ${token}`;
        }
    }

    const response = await fetch(`${API_BASE_URL}${url}`, {
        ...restOptions,
        headers: requestHeaders,
    });

    // Handle 401 unauthorized
    if (response.status === 401) {
        authService.logout();
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
        throw new Error('Unauthorized');
    }

    return response;
}
