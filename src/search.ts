import { ProfileAPI } from './api.js';
import { Chat, User } from './types.js';

export class SearchManager {
    private api: ProfileAPI;
    private homeManager: any;
    public isOpen = false; // Добавляем свойство isOpen

    constructor(api: ProfileAPI, homeManager: any) {
        this.api = api;
        this.homeManager = homeManager;
        this.isOpen = false; // Инициализируем
        this.initSearch();
    }

    private initSearch(): void {
        this.createSearchModal();
        this.setupSearchListeners();
    }

    private createSearchModal(): void {
        const modalHTML = `
            <div class="search-modal-overlay hidden" id="searchModal">
                <div class="search-modal">
                    <div class="search-modal-header">
                        <div class="search-header-content">
                            <i class="fas fa-search search-header-icon"></i>
                            <h3>Поиск</h3>
                        </div>
                        <button class="search-close-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="search-input-container">
                        <div class="search-box">
                            <i class="fas fa-search search-icon"></i>
                            <input type="text" id="globalSearchInput" 
                                placeholder="Введите имя пользователя или название чата..." 
                                class="search-input">
                            <button class="search-clear-btn hidden">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>

                    <div class="search-results" id="searchResults">
                        <div class="search-empty">
                            <i class="fas fa-search"></i>
                            <p>Введите запрос для поиска</p>
                            <span>Ищите пользователей и чаты по имени</span>
                        </div>
                    </div>

                    <div class="search-footer">
                        <div class="search-shortcut">
                            <kbd>Esc</kbd> для закрытия
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.setupModalListeners();
    }

    private setupSearchListeners(): void {
        // Находим кнопку поиска в заголовке чата и добавляем функционал
        const searchBtn = document.querySelector('.header-action-btn[title="Поиск"]');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.openSearch());
        }

        // Глобальный хоткей Ctrl+K или /
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if ((e.ctrlKey && e.key === 'k') || e.key === '/') {
                e.preventDefault();
                this.openSearch();
            }
        });
    }

    private setupModalListeners(): void {
        const modal = document.getElementById('searchModal');
        const closeBtn = modal?.querySelector('.search-close-btn');
        const searchInput = document.getElementById('globalSearchInput') as HTMLInputElement;
        const clearBtn = modal?.querySelector('.search-clear-btn');

        // Закрытие модалки
        closeBtn?.addEventListener('click', () => this.closeSearch());
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) this.closeSearch();
        });

        // Очистка поиска
        clearBtn?.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
                this.clearResults();
            }
        });

        // Ввод поискового запроса
        searchInput?.addEventListener('input', (e) => {
            const query = (e.target as HTMLInputElement).value.trim();
            
            // Показываем/скрываем кнопку очистки
            if (clearBtn) {
                clearBtn.classList.toggle('hidden', !query);
            }

            // Дебаунс поиска
            this.debouncedSearch(query);
        });

        // Enter для быстрого выбора первого результата
        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.selectFirstResult();
            }
        });

        // Закрытие по Escape
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closeSearch();
            }
        });
    }

    private debouncedSearch = this.debounce((query: string) => {
        this.performSearch(query);
    }, 300);

    private debounce(func: Function, wait: number): Function {
        let timeout: number;
        return function executedFunction(...args: any[]) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    private async performSearch(query: string): Promise<void> {
        if (!query || query.length < 2) {
            this.clearResults();
            return;
        }

        this.setLoading(true);

        try {
            const results = await this.api.universalSearch(query, this.homeManager.chats || []);
            this.renderResults(results, query);

        } catch (error) {
            console.error('Search failed:', error);
            this.showError('Ошибка поиска');
        } finally {
            this.setLoading(false);
        }
    }

    private renderResults(results: { users: User[], chats: Chat[] }, query: string): void {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;

        const { users, chats } = results;
        const hasUsers = users.length > 0;
        const hasChats = chats.length > 0;

        if (!hasUsers && !hasChats) {
            resultsContainer.innerHTML = `
                <div class="search-empty">
                    <i class="fas fa-search"></i>
                    <p>Ничего не найдено</p>
                    <span>Попробуйте изменить запрос "${this.escapeHtml(query)}"</span>
                </div>
            `;
            return;
        }

        let resultsHTML = '';

        if (hasUsers) {
            resultsHTML += this.renderUsersResults(users, query);
        }

        if (hasChats) {
            resultsHTML += this.renderChatsResults(chats, query);
        }

        resultsContainer.innerHTML = resultsHTML;
        this.setupResultItemsListeners();
    }

    private renderUsersResults(users: User[], query: string): string {
        const currentUserId = this.homeManager.currentUser?.id;
        
        return `
            <div class="search-results-section">
                <div class="search-section-header">
                    <i class="fas fa-users"></i>
                    <h4>Люди</h4>
                    <span class="search-count">${users.length}</span>
                </div>
                <div class="search-results-list">
                    ${users.map(user => {
                        const isCurrentUser = user.id === currentUserId;
                        const actionText = isCurrentUser ? "Открыть профиль" : "Написать сообщение";
                        const actionIcon = isCurrentUser ? "fa-user" : "fa-comment";
                        
                        return `
                            <div class="search-result-item user-result" data-user-id="${user.id}" data-is-self="${isCurrentUser}">
                                <div class="result-avatar">
                                    <img src="${user.avatar_url || user.avatar || user.url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=40&h=40&fit=crop&crop=face'}" 
                                        alt="${user.name}">
                                    ${isCurrentUser ? '<div class="self-badge"><i class="fas fa-star"></i></div>' : ''}
                                </div>
                                <div class="result-info">
                                    <div class="result-name">${this.highlightText(user.name, query)}</div>
                                    <div class="result-username">@${this.escapeHtml(user.username)}</div>
                                    ${isCurrentUser ? '<div class="result-self-label">Это вы</div>' : ''}
                                </div>
                                <button class="result-action-btn" title="${actionText}">
                                    <i class="fas ${actionIcon}"></i>
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    private renderChatsResults(chats: Chat[], query: string): string {
        return `
            <div class="search-results-section">
                <div class="search-section-header">
                    <i class="fas fa-comments"></i>
                    <h4>Чаты</h4>
                    <span class="search-count">${chats.length}</span>
                </div>
                <div class="search-results-list">
                    ${chats.map(chat => `
                        <div class="search-result-item chat-result" data-chat-id="${chat.id}">
                            <div class="result-avatar">
                                <img src="${chat.avatar_url || chat.avatar || chat.url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=40&h=40&fit=crop&crop=face'}" 
                                    alt="${chat.name}">
                                ${chat.is_group ? '<div class="group-badge"><i class="fas fa-users"></i></div>' : ''}
                            </div>
                            <div class="result-info">
                                <div class="result-name">${this.highlightText(chat.name, query)}</div>
                                <div class="result-meta">
                                    ${this.getChatPreview(chat)}
                                </div>
                            </div>
                            <div class="result-arrow">
                                <i class="fas fa-chevron-right"></i>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    private getChatPreview(chat: Chat): string {
        if (chat.is_group) {
            return `Группа • ${chat.count_members || 0} участников`;
        } else {
            return 'Личный чат';
        }
    }

    private highlightText(text: string, query: string): string {
        const escapedText = this.escapeHtml(text);
        const escapedQuery = this.escapeHtml(query);
        
        if (!escapedQuery) return escapedText;
        
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        return escapedText.replace(regex, '<mark>$1</mark>');
    }

    private setupResultItemsListeners(): void {
        // Обработчики для пользователей
        document.querySelectorAll('.user-result').forEach(item => {
            item.addEventListener('click', () => {
                const userId = parseInt(item.getAttribute('data-user-id')!);
                const isSelf = item.getAttribute('data-is-self') === 'true';
                
                if (isSelf) {
                    // Открываем профиль текущего пользователя
                    this.closeSearch();
                    if (this.homeManager.profileManager) {
                        this.homeManager.profileManager.openMyProfile();
                    }
                } else {
                    // Начинаем чат с другим пользователем
                    this.startChatWithUser(userId);
                }
            });
        });
    
        // Обработчики для чатов
        document.querySelectorAll('.chat-result').forEach(item => {
            item.addEventListener('click', () => {
                const chatId = parseInt(item.getAttribute('data-chat-id')!);
                this.openChat(chatId);
            });
        });
    }

    private async startChatWithUser(userId: number): Promise<void> {
        try {
            console.log('👤 Starting chat with user ID:', userId);
            
            // Проверяем, не пытаемся ли начать чат с самим собой
            if (this.homeManager.currentUser && userId === this.homeManager.currentUser.id) {
                console.log('❌ Cannot start chat with yourself');
                this.closeSearch();
                
                // Открываем свой профиль вместо чата
                if (this.homeManager.profileManager) {
                    this.homeManager.profileManager.openMyProfile();
                }
                return;
            }
            
            // Создаем/получаем чат через create121Chat
            const chat = await this.api.create121Chat(userId);
            
            console.log('✅ Chat created/retrieved:', chat);
            
            this.closeSearch();
            
            // ВАЖНО: Добавляем чат в список чатов HomeManager
            this.homeManager.addNewChat(chat);
            
            // И открываем этот чат
            this.homeManager.selectChat(chat);
            
        } catch (error) {
            console.error('Failed to create/access chat:', error);
            this.showError('Не удалось открыть чат');
        }
    }

    private async openChat(chatId: number): Promise<void> {
        this.closeSearch();
        
        // Находим чат в списке и открываем его
        const chat = this.homeManager.chats.find((c: Chat) => c.id === chatId);
        if (chat) {
            this.homeManager.selectChat(chat);
        }
    }

    private selectFirstResult(): void {
        const firstResult = document.querySelector('.search-result-item');
        if (firstResult) {
            firstResult.dispatchEvent(new Event('click'));
        }
    }

    private setLoading(isLoading: boolean): void {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;

        if (isLoading) {
            resultsContainer.innerHTML = `
                <div class="search-loading">
                    <div class="loading-spinner"></div>
                    <p>Поиск...</p>
                </div>
            `;
        }
    }

    private clearResults(): void {
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="search-empty">
                    <i class="fas fa-search"></i>
                    <p>Введите запрос для поиска</p>
                    <span>Ищите пользователей и чаты по имени</span>
                </div>
            `;
        }
    }

    public openSearch(): void {
        const modal = document.getElementById('searchModal');
        const searchInput = document.getElementById('globalSearchInput') as HTMLInputElement;
        
        if (modal && searchInput) {
            modal.classList.remove('hidden');
            searchInput.focus();
            this.isOpen = true;
        }
    }

    public closeSearch(): void {
        const modal = document.getElementById('searchModal');
        const searchInput = document.getElementById('globalSearchInput') as HTMLInputElement;
        
        if (modal && searchInput) {
            modal.classList.add('hidden');
            searchInput.value = '';
            this.clearResults();
            this.isOpen = false;
        }
    }

    private showError(message: string): void {
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="search-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    private escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}