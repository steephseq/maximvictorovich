import { ProfileAPI } from './api.js';
import { User, Chat } from './types.js';

export class GroupManager {
    private api: ProfileAPI;
    private homeManager: any;

    constructor(api: ProfileAPI, homeManager: any) {
        this.api = api;
        this.homeManager = homeManager;
        this.initGroupCreation();
    }

    private initGroupCreation(): void {
        this.createGroupModal();
        this.setupGroupCreationListeners();
    }

    private createGroupModal(): void {
        const modalHTML = `
            <div class="group-modal-overlay hidden" id="groupModal">
                <div class="group-modal">
                    <div class="group-modal-header">
                        <div class="group-header-content">
                            <i class="fas fa-users group-header-icon"></i>
                            <h3>Создать группу</h3>
                        </div>
                        <button class="group-close-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="group-form">
                        <div class="form-group">
                            <label for="groupName">Название группы</label>
                            <input type="text" id="groupName" 
                                   placeholder="Введите название группы..." 
                                   class="group-input">
                        </div>

                        <div class="form-group">
                            <label for="userSearch">Добавить участников</label>
                            <div class="user-search-box">
                                <i class="fas fa-search user-search-icon"></i>
                                <input type="text" id="userSearch" 
                                       placeholder="Поиск пользователей..." 
                                       class="user-search-input">
                            </div>
                        </div>

                        <div class="selected-users" id="selectedUsers">
                            <div class="selected-users-empty">
                                <i class="fas fa-user-plus"></i>
                                <span>Пока нет выбранных пользователей</span>
                            </div>
                        </div>

                        <div class="users-search-results hidden" id="usersSearchResults"></div>
                    </div>

                    <div class="group-modal-footer">
                        <button class="btn-secondary group-cancel-btn">Отмена</button>
                        <button class="btn-primary group-create-btn" disabled>
                            <i class="fas fa-plus"></i> Создать группу
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.setupModalListeners();
    }

    private setupGroupCreationListeners(): void {
        const newChatBtn = document.querySelector('.new-chat-btn');
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => {
                this.openGroupCreation();
            });
        }
    }

    private setupModalListeners(): void {
        const modal = document.getElementById('groupModal');
        const closeBtn = modal?.querySelector('.group-close-btn') as HTMLButtonElement;
        const cancelBtn = modal?.querySelector('.group-cancel-btn') as HTMLButtonElement;
        const createBtn = modal?.querySelector('.group-create-btn') as HTMLButtonElement;
        const groupNameInput = document.getElementById('groupName') as HTMLInputElement;
        const userSearchInput = document.getElementById('userSearch') as HTMLInputElement;

        closeBtn?.addEventListener('click', () => this.closeGroupCreation());
        cancelBtn?.addEventListener('click', () => this.closeGroupCreation());
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) this.closeGroupCreation();
        });

        createBtn?.addEventListener('click', () => {
            this.createGroup();
        });

        groupNameInput?.addEventListener('input', () => {
            this.validateForm();
        });

        userSearchInput?.addEventListener('input', (e) => {
            const query = (e.target as HTMLInputElement).value.trim();
            this.debouncedUserSearch(query);
        });

        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
                this.closeGroupCreation();
            }
        });

        groupNameInput?.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' && createBtn && !createBtn.disabled) {
                this.createGroup();
            }
        });
    }

    private debouncedUserSearch = this.debounce((query: string) => {
        this.searchUsers(query);
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

    private async searchUsers(query: string): Promise<void> {
        const resultsContainer = document.getElementById('usersSearchResults');
        if (!resultsContainer) return;

        if (!query || query.length < 2) {
            resultsContainer.classList.add('hidden');
            return;
        }

        try {
            const users = await this.api.searchUsers(query);
            this.renderUserSearchResults(users);
        } catch (error) {
            console.error('User search failed:', error);
        }
    }

    private renderUserSearchResults(users: User[]): void {
        const resultsContainer = document.getElementById('usersSearchResults');
        if (!resultsContainer) return;

        if (users.length === 0) {
            resultsContainer.innerHTML = `
                <div class="search-empty">
                    <i class="fas fa-search"></i>
                    <p>Пользователи не найдены</p>
                </div>
            `;
        } else {
            resultsContainer.innerHTML = `
                <div class="users-list">
                    ${users.map(user => `
                        <div class="user-search-result" data-user-id="${user.id}">
                            <div class="user-avatar">
                                <img src="${user.avatar_url || user.avatar || user.url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=40&h=40&fit=crop&crop=face'}" 
                                     alt="${user.name}">
                            </div>
                            <div class="user-info">
                                <div class="user-name">${this.escapeHtml(user.name)}</div>
                                <div class="user-username">@${this.escapeHtml(user.username)}</div>
                            </div>
                            <button class="add-user-btn" title="Добавить">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            `;

            resultsContainer.querySelectorAll('.add-user-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const userResult = (e.target as HTMLElement).closest('.user-search-result');
                    if (userResult) {
                        const userId = parseInt(userResult.getAttribute('data-user-id')!);
                        this.addUserToSelection(userId, userResult);
                    }
                });
            });

            resultsContainer.querySelectorAll('.user-search-result').forEach(item => {
                item.addEventListener('click', (e) => {
                    const userId = parseInt(item.getAttribute('data-user-id')!);
                    this.addUserToSelection(userId, item);
                });
            });
        }

        resultsContainer.classList.remove('hidden');
    }

    private addUserToSelection(userId: number, userElement: Element): void {
        const selectedUsersContainer = document.getElementById('selectedUsers');
        if (!selectedUsersContainer) return;

        const existingUser = selectedUsersContainer.querySelector(`[data-user-id="${userId}"]`);
        if (existingUser) return;

        const userName = userElement.querySelector('.user-name')?.textContent || 'Пользователь';
        const userAvatar = userElement.querySelector('.user-avatar img')?.getAttribute('src') || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=40&h=40&fit=crop&crop=face';

        const emptyState = selectedUsersContainer.querySelector('.selected-users-empty');
        if (emptyState) {
            emptyState.remove();
        }

        const userChip = document.createElement('div');
        userChip.className = 'selected-user-chip';
        userChip.setAttribute('data-user-id', userId.toString());
        userChip.innerHTML = `
            <img src="${userAvatar}" alt="${userName}" class="selected-user-avatar">
            <span class="selected-user-name">${userName}</span>
            <button class="remove-user-btn" title="Удалить">
                <i class="fas fa-times"></i>
            </button>
        `;

        const removeBtn = userChip.querySelector('.remove-user-btn') as HTMLButtonElement;
        removeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            userChip.remove();
            this.checkEmptyState();
            this.validateForm();
        });

        selectedUsersContainer.appendChild(userChip);

        const userSearchInput = document.getElementById('userSearch') as HTMLInputElement;
        if (userSearchInput) {
            userSearchInput.value = '';
        }
        const resultsContainer = document.getElementById('usersSearchResults');
        if (resultsContainer) {
            resultsContainer.classList.add('hidden');
        }

        this.validateForm();
    }

    private checkEmptyState(): void {
        const selectedUsersContainer = document.getElementById('selectedUsers');
        if (!selectedUsersContainer) return;

        const selectedUsers = selectedUsersContainer.querySelectorAll('.selected-user-chip');
        if (selectedUsers.length === 0) {
            selectedUsersContainer.innerHTML = `
                <div class="selected-users-empty">
                    <i class="fas fa-user-plus"></i>
                    <span>Пока нет выбранных пользователей</span>
                </div>
            `;
        }
    }

    private getSelectedUserIds(): number[] {
        const selectedUsersContainer = document.getElementById('selectedUsers');
        if (!selectedUsersContainer) return [];

        const userChips = selectedUsersContainer.querySelectorAll('.selected-user-chip');
        return Array.from(userChips).map(chip => 
            parseInt(chip.getAttribute('data-user-id')!)
        );
    }

    private validateForm(): void {
        const groupNameInput = document.getElementById('groupName') as HTMLInputElement;
        const createBtn = document.querySelector('.group-create-btn') as HTMLButtonElement;

        if (groupNameInput && createBtn) {
            const isValid = groupNameInput.value.trim().length > 0;
            createBtn.disabled = !isValid;
        }
    }

    private async createGroup(): Promise<void> {
        const groupNameInput = document.getElementById('groupName') as HTMLInputElement;
        const groupName = groupNameInput?.value.trim();
        const selectedUserIds = this.getSelectedUserIds();

        if (!groupName) {
            this.showError('Введите название группы');
            return;
        }

        const createBtn = document.querySelector('.group-create-btn') as HTMLButtonElement;
        const originalBtnText = createBtn.innerHTML;
        
        createBtn.disabled = true;
        createBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Создание...';

        try {
            const newChat = await this.api.createGroup(groupName, selectedUserIds);
            
            if (!newChat || !newChat.id) {
                throw new Error('Бекенд не вернул корректные данные чата');
            }
            
            this.closeGroupCreation();
            this.homeManager.addNewChat(newChat);
            
            setTimeout(() => {
                this.homeManager.selectChat(newChat);
            }, 300);
            
        } catch (error: any) {
            console.error('Ошибка создания группы:', error);
            
            let errorMessage = 'Не удалось создать группу';
            if (error.message?.includes('network') || error.message?.includes('fetch')) {
                errorMessage = 'Ошибка сети. Проверьте подключение.';
            } else if (error.message?.includes('authorized') || error.message?.includes('token')) {
                errorMessage = 'Ошибка авторизации. Войдите заново.';
            } else if (error.message?.includes('duplicate key')) {
                errorMessage = 'Чат с таким названием уже существует';
            }
            
            this.showError(errorMessage);
        } finally {
            if (createBtn) {
                createBtn.disabled = false;
                createBtn.innerHTML = originalBtnText;
            }
        }
    }

    public openGroupCreation(): void {
        const modal = document.getElementById('groupModal');
        const groupNameInput = document.getElementById('groupName') as HTMLInputElement;
        
        if (modal && groupNameInput) {
            modal.classList.remove('hidden');
            groupNameInput.focus();
            this.resetForm();
            
            setTimeout(() => {
                modal.classList.add('group-modal-open');
            }, 10);
        }
    }

    public closeGroupCreation(): void {
        const modal = document.getElementById('groupModal');
        
        if (modal) {
            modal.classList.remove('group-modal-open');
            
            setTimeout(() => {
                modal.classList.add('hidden');
                this.resetForm();
            }, 200);
        }
    }

    private resetForm(): void {
        const groupNameInput = document.getElementById('groupName') as HTMLInputElement;
        const userSearchInput = document.getElementById('userSearch') as HTMLInputElement;
        const resultsContainer = document.getElementById('usersSearchResults');
        
        if (groupNameInput) groupNameInput.value = '';
        if (userSearchInput) userSearchInput.value = '';
        if (resultsContainer) {
            resultsContainer.classList.add('hidden');
        }

        this.checkEmptyState();
        this.validateForm();
    }

    private showError(message: string): void {
        alert(message);
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