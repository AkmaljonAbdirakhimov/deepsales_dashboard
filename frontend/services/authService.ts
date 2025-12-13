import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface User {
    id: number;
    username: string;
    role: 'super_admin' | 'company';
    companyId?: number;
    companyName?: string;
    databaseName?: string;
}

export interface LoginResponse {
    user: User;
    token: string;
}

class AuthService {
    private tokenKey = 'auth_token';
    private userKey = 'auth_user';

    /**
     * Login with username and password
     */
    async login(username: string, password: string): Promise<LoginResponse> {
        try {
            const response = await axios.post<LoginResponse>(`${API_URL}/api/auth/login`, {
                username,
                password
            });

            // Store token and user in localStorage
            localStorage.setItem(this.tokenKey, response.data.token);
            localStorage.setItem(this.userKey, JSON.stringify(response.data.user));

            return response.data;
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'Login failed');
        }
    }

    /**
     * Logout current user
     */
    logout(): void {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
    }

    /**
     * Get current token
     */
    getToken(): string | null {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(this.tokenKey);
    }

    /**
     * Get current user
     */
    getCurrentUser(): User | null {
        if (typeof window === 'undefined') return null;
        const userStr = localStorage.getItem(this.userKey);
        if (!userStr) return null;
        try {
            return JSON.parse(userStr);
        } catch {
            return null;
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return !!this.getToken();
    }

    /**
     * Check if user is super admin
     */
    isSuperAdmin(): boolean {
        const user = this.getCurrentUser();
        return user?.role === 'super_admin';
    }

    /**
     * Check if user is company user
     */
    isCompanyUser(): boolean {
        const user = this.getCurrentUser();
        return user?.role === 'company';
    }

    /**
     * Get authorization header
     */
    getAuthHeader(): { Authorization: string } | {} {
        const token = this.getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    }

    /**
     * Refresh current user info from server
     */
    async refreshUser(): Promise<User> {
        try {
            const token = this.getToken();
            if (!token) {
                throw new Error('Not authenticated');
            }

            const response = await axios.get<{ user: User }>(`${API_URL}/api/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            localStorage.setItem(this.userKey, JSON.stringify(response.data.user));
            return response.data.user;
        } catch (error: any) {
            this.logout();
            throw new Error(error.response?.data?.error || 'Failed to refresh user');
        }
    }

    /**
     * Change password
     */
    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
        try {
            const token = this.getToken();
            if (!token) {
                throw new Error('Not authenticated');
            }

            await axios.put(
                `${API_URL}/api/auth/change-password`,
                {
                    currentPassword,
                    newPassword
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
        } catch (error: any) {
            throw new Error(error.response?.data?.error || 'Failed to change password');
        }
    }
}

export const authService = new AuthService();
