import { ProfileAPI } from './api.js';
import type { RegisterRequest } from './types.js';

class RegisterManager {
    private api: ProfileAPI;

    constructor() {
        this.api = new ProfileAPI();
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        const form = document.getElementById('registerForm') as HTMLFormElement;
        const passwordToggles = document.querySelectorAll('.password-toggle');

        form?.addEventListener('submit', (e) => this.handleRegister(e));
        
        passwordToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                const targetId = (e.target as HTMLElement).closest('button')?.dataset.target;
                if (targetId) {
                    this.togglePasswordVisibility(targetId);
                }
            });
        });

        // Валидация паролей в реальном времени
        const passwordInput = document.getElementById('password') as HTMLInputElement;
        const confirmInput = document.getElementById('confirmPassword') as HTMLInputElement;

        confirmInput?.addEventListener('input', () => {
            this.validatePasswords();
        });
    }

    private togglePasswordVisibility(targetId: string): void {
        const input = document.getElementById(targetId) as HTMLInputElement;
        const toggle = document.querySelector(`[data-target="${targetId}"] i`) as HTMLElement;
        
        if (input && toggle) {
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            toggle.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
        }
    }

    private validatePasswords(): boolean {
        const password = (document.getElementById('password') as HTMLInputElement).value;
        const confirmPassword = (document.getElementById('confirmPassword') as HTMLInputElement).value;
        
        if (confirmPassword && password !== confirmPassword) {
            this.showFieldError('confirmPassword', 'Пароли не совпадают');
            return false;
        } else {
            this.hideFieldError('confirmPassword');
            return true;
        }
    }

    private async handleRegister(e: Event): Promise<void> {
    e.preventDefault();

    if (!this.validateForm()) return;
    
    const userData: RegisterRequest = {
        name: (document.getElementById('name') as HTMLInputElement).value,
        username: (document.getElementById('username') as HTMLInputElement).value,
        email: (document.getElementById('email') as HTMLInputElement).value,
        password: (document.getElementById('password') as HTMLInputElement).value
    };
    
    this.setLoading(true);
    this.hideMessage();

    try {
        await this.api.register(userData); // просто ждем завершения
        console.log('Регистрация успешна');
        this.showSuccess('Регистрация успешна! Перенаправляем на вход...');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        this.showError(error instanceof Error ? error.message : 'Ошибка регистрации');
    } finally {
        this.setLoading(false);
    }
}

    private validateForm(): boolean {
        let isValid = true;

        // Проверка обязательных полей
        const requiredFields = ['name', 'username', 'email', 'password', 'confirmPassword'];
        requiredFields.forEach(field => {
            const input = document.getElementById(field) as HTMLInputElement;
            if (!input.value.trim()) {
                this.showFieldError(field, 'Это поле обязательно');
                isValid = false;
            } else {
                this.hideFieldError(field);
            }
        });

        // Проверка паролей
        if (!this.validatePasswords()) {
            isValid = false;
        }

        // Проверка условий
        const terms = document.getElementById('terms') as HTMLInputElement;
        if (!terms.checked) {
            this.showError('Необходимо согласие с условиями использования');
            isValid = false;
        }

        return isValid;
    }

    private showFieldError(fieldId: string, message: string): void {
        const input = document.getElementById(fieldId) as HTMLInputElement;
        input.classList.add('error');
        
        // Удаляем старую ошибку если есть
        const existingError = input.parentElement?.querySelector('.field-error');
        if (existingError) existingError.remove();

        // Добавляем сообщение об ошибке
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error text-red-500 text-sm mt-1';
        errorDiv.textContent = message;
        input.parentElement?.appendChild(errorDiv);
    }

    private hideFieldError(fieldId: string): void {
        const input = document.getElementById(fieldId) as HTMLInputElement;
        input.classList.remove('error');
        
        const errorDiv = input.parentElement?.querySelector('.field-error');
        if (errorDiv) errorDiv.remove();
    }

    private setLoading(loading: boolean): void {
        const btn = document.querySelector('.register-btn') as HTMLButtonElement;
        if (!btn) return;

        const btnText = btn.querySelector('.btn-text') as HTMLElement;
        const btnLoader = btn.querySelector('.btn-loader') as HTMLElement;

        if (loading) {
            btn.disabled = true;
            btnText?.classList.add('hidden');
            btnLoader?.classList.remove('hidden');
        } else {
            btn.disabled = false;
            btnText?.classList.remove('hidden');
            btnLoader?.classList.add('hidden');
        }
    }

    private showError(message: string): void {
        this.showMessage(message, 'error');
    }

    private showSuccess(message: string): void {
        this.showMessage(message, 'success');
    }

    private showMessage(message: string, type: 'error' | 'success'): void {
        const messageDiv = document.getElementById('message') as HTMLDivElement;
        if (messageDiv) {
            messageDiv.textContent = message;
            messageDiv.className = `message ${type}`;
            messageDiv.classList.remove('hidden');
        }
    }

    private hideMessage(): void {
        const messageDiv = document.getElementById('message') as HTMLDivElement;
        if (messageDiv) {
            messageDiv.classList.add('hidden');
            messageDiv.className = 'message hidden';
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new RegisterManager();
});