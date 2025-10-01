interface JwtPayload {
    exp: number;
    iat: number;
    userID: number;
}

export class AuthManager {
    private tokenKey = 'token';

    saveToken(token: string): void {
        localStorage.setItem(this.tokenKey, token);
    }

    getToken(): string | null {
        return localStorage.getItem(this.tokenKey);
    }

    isTokenValid(): boolean {
        const token = this.getToken();
        if (!token) return false;

        try {
            const payload: JwtPayload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp * 1000 > Date.now();
        } catch {
            return false;
        }
    }

    logout(): void {
        localStorage.removeItem(this.tokenKey);
        window.location.href = '/login.html';
    }

    getAuthHeaders(): HeadersInit {
        const token = this.getToken();
        if (!token) {
            throw new Error('Токен не найден');
        }

        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }
}

export const authManager = new AuthManager();