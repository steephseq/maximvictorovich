import { authManager } from './auth.js';
import { ProfileAPI } from './api.js';
import type { LoginRequest } from './types.js';

class LoginManager {
    private api: ProfileAPI;

    constructor() {
        this.api = new ProfileAPI();
        this.setupEventListeners();
        this.checkExistingAuth();
    }

    private setupEventListeners(): void {
        const form = document.getElementById('loginForm') as HTMLFormElement;
        const passwordToggle = document.getElementById('passwordToggle') as HTMLButtonElement;
        const passwordInput = document.getElementById('password') as HTMLInputElement;

        form.addEventListener('submit', (e) => this.handleLogin(e));
        
        passwordToggle.addEventListener('click', () => {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            const icon = passwordToggle.querySelector('i') as HTMLElement;
            icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
        });
    }

private checkExistingAuth(): void {
    // Эта функция нужна только на login.html
    // Если токен валиден, редиректим с логина на home
    if (authManager.isTokenValid()) {
        window.location.href = 'home.html';
    }
}

    private async handleLogin(e: Event): Promise<void> {
        e.preventDefault();
        
        const email = (document.getElementById('email') as HTMLInputElement).value;
        const password = (document.getElementById('password') as HTMLInputElement).value;
        
        this.setLoading(true);
        this.hideError();

        try {
            const credentials: LoginRequest = { email, password };
            const token = await this.api.login(credentials);
            console.log(token)
            authManager.saveToken(token);
            this.showSuccess('Вход выполнен успешно!');
            
            setTimeout(() => {
                window.location.href = 'home.html'; // Было profile.html
            }, 1000);
            
        } catch (error) {
            this.showError(error instanceof Error ? error.message : 'Ошибка входа');
        } finally {
            this.setLoading(false);
        }
    }

    private setLoading(loading: boolean): void {
        const btn = document.querySelector('.login-btn') as HTMLButtonElement;
        const btnText = btn.querySelector('.btn-text') as HTMLElement;
        const btnLoader = btn.querySelector('.btn-loader') as HTMLElement;

        if (loading) {
            btn.disabled = true;
            btnText.classList.add('hidden');
            btnLoader.classList.remove('hidden');
        } else {
            btn.disabled = false;
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
        }
    }

    private showError(message: string): void {
        const errorDiv = document.getElementById('errorMessage') as HTMLDivElement;
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }

    private showSuccess(message: string): void {
        const errorDiv = document.getElementById('errorMessage') as HTMLDivElement;
        errorDiv.style.background = '#d1fae5';
        errorDiv.style.borderColor = '#a7f3d0';
        errorDiv.style.color = '#065f46';
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }

    private hideError(): void {
        const errorDiv = document.getElementById('errorMessage') as HTMLDivElement;
        errorDiv.classList.add('hidden');
        errorDiv.style.background = '';
        errorDiv.style.borderColor = '';
        errorDiv.style.color = '';
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new LoginManager();
});