import { ProfileAPI } from './api.js';
import { User, Chat } from './types.js';

export class GroupManager {
    private api: ProfileAPI;
    private homeManager: any;
    private currentChatId: number = 0;
    private currentUser: User | null = null;

    constructor(api: ProfileAPI, homeManager: any) {
        this.api = api;
        this.homeManager = homeManager;
        
        // Для отладки - добавляем в глобальную область
        (window as any).groupManager = this;
        
        setTimeout(() => {
            this.initGroupCreation();
            this.setupGroupManagement();
            this.loadCurrentUser();
        }, 1000);
    }

    private async loadCurrentUser() {
        try {
            this.currentUser = await this.api.getProfile();
        } catch (error) {
            console.error('Ошибка загрузки текущего пользователя:', error);
        }
    }

    public setCurrentChatId(chatId: number) {
        this.currentChatId = chatId;
    }

    public setCurrentUser(user: User) {
        this.currentUser = user;
    }

    public async leaveGroup(): Promise<void> {
        if (!this.currentChatId) {
            alert('Ошибка: не выбран чат');
            return;
        }
        
        if (!this.currentUser) {
            alert('Ошибка: пользователь не загружен');
            return;
        }
        
        if (!confirm(`Вы уверены, что хотите покинуть группу?`)) {
            return;
        }
        
        try {
            await this.api.removeUserFromChat(this.currentChatId, this.currentUser.id);
            alert('Вы покинули группу');
            window.location.reload();
        } catch (error: any) {
            let errorMessage = 'Не удалось покинуть группу';
            if (error.message?.includes('403')) {
                errorMessage = 'Недостаточно прав для выхода из группы';
            } else if (error.message?.includes('404')) {
                errorMessage = 'Чат не найден';
            } else if (error.message?.includes('user not into chat')) {
                errorMessage = 'Вы не участник этой группы';
            }
            alert(errorMessage);
        }
    }

    private filterAvailableActions(actions: any, targetUser: User): Array<{id: string, label: string, icon: string, danger?: boolean}> {
        const availableActions = [];
        const isSelf = this.currentUser && this.currentUser.id === targetUser.id;

        if (actions.CanDeleteUser && !isSelf) {
            availableActions.push({
                id: 'delete_user',
                label: 'Удалить из чата',
                icon: 'fas fa-user-times',
                danger: true
            });
        }

        if (actions.CanManageRoles && !isSelf) {
            availableActions.push({
                id: 'toggle_admin',
                label: 'Сделать админом',
                icon: 'fas fa-user-shield'
            });
        }

        if (actions.CanBanUser && !isSelf) {
            availableActions.push({
                id: 'ban_user',
                label: 'Заблокировать',
                icon: 'fas fa-ban',
                danger: true
            });
        }

        return availableActions;
    }

    private renderUserActions(targetUser: User, actions: Array<{id: string, label: string, icon: string, danger?: boolean}>): void {
        const actionsList = document.getElementById('userActionsList');
        if (!actionsList) return;

        actionsList.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'action-header';
        header.innerHTML = `
            <div class="member-info">
                <img src="${targetUser.avatar_url || targetUser.avatar || targetUser.url || 'https://via.placeholder.com/40'}" 
                     alt="${targetUser.name}" 
                     class="member-avatar-small">
                <div class="member-details">
                    <span class="member-name">${targetUser.name || 'Без имени'}</span>
                    <span class="member-username">@${targetUser.username || 'user'}</span>
                </div>
            </div>
        `;
        actionsList.appendChild(header);

        actions.forEach(action => {
            const actionBtn = document.createElement('button');
            actionBtn.className = `action-btn ${action.danger ? 'danger' : ''}`;
            actionBtn.innerHTML = `
                <i class="${action.icon}"></i>
                <span>${action.label}</span>
            `;
            actionBtn.addEventListener('click', () => {
                this.handleUserAction(action.id, targetUser);
            });
            actionsList.appendChild(actionBtn);
        });
    }

    private async handleUserAction(actionId: string, targetUser: User): Promise<void> {
        switch (actionId) {
            case 'delete_user':
                await this.deleteUserFromChat(targetUser);
                break;
            case 'toggle_admin':
                await this.toggleAdminRole(targetUser);
                break;
            case 'ban_user':
                await this.banUser(targetUser);
                break;
        }
        this.hideUserActionsModal();
    }

    private async deleteUserFromChat(targetUser: User): Promise<void> {
        if (!this.currentChatId) return;

        if (!confirm(`Вы уверены, что хотите удалить ${targetUser.name} из чата?`)) {
            return;
        }

        try {
            await this.api.removeUserFromChat(this.currentChatId, targetUser.id);
            this.triggerProfileUpdate();
        } catch (error) {
            console.error('Ошибка при удалении пользователя:', error);
            alert('Ошибка при удалении пользователя');
        }
    }

    private async toggleAdminRole(targetUser: User): Promise<void> {
        alert(`Роль пользователя ${targetUser.name} изменена`);
    }

    private async banUser(targetUser: User): Promise<void> {
        if (!confirm(`Заблокировать пользователя ${targetUser.name}?`)) {
            return;
        }
    }

    public async showUserActions(chatId: number, targetUser: User): Promise<void> {
        this.currentChatId = chatId;

        try {
            const actions = await this.api.getAvailableUserActions(chatId);
            const availableActions = this.filterAvailableActions(actions, targetUser);

            if (availableActions.length === 0) return;

            this.renderUserActions(targetUser, availableActions);
            this.showUserActionsModal();
        } catch (error) {
            console.error('Ошибка получения доступных действий:', error);
        }
    }

    private showUserActionsModal(): void {
        const modal = document.getElementById('userActionsModal');
        if (!modal) return;

        modal.classList.remove('hidden');
        modal.style.display = 'flex';

        const overlay = modal.querySelector('.modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => {
                this.hideUserActionsModal();
            });
        }
    }

    private hideUserActionsModal(): void {
        const modal = document.getElementById('userActionsModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    }

    private triggerProfileUpdate(): void {
        const event = new CustomEvent('profileUpdateRequested');
        document.dispatchEvent(event);
    }

    private setupGroupManagement(): void {
        document.getElementById('leaveGroupBtn')?.addEventListener('click', () => {
            this.leaveGroup();
        });

        document.getElementById('closeUserActionsModal')?.addEventListener('click', () => {
            this.hideUserActionsModal();
        });
    }

    private initGroupCreation(): void {
        this.setupGroupCreationListeners();
        this.setupModalListeners();
    }

    private setupGroupCreationListeners(): void {
        const setupHandler = () => {
            const newChatBtn = document.querySelector('.new-chat-btn');
            
            if (newChatBtn) {
                // Удаляем все старые обработчики
                const newBtn = newChatBtn.cloneNode(true) as HTMLElement;
                newChatBtn.parentNode?.replaceChild(newBtn, newChatBtn);
                
                // Добавляем новый обработчик
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.openGroupCreation();
                });
                
                // Добавляем визуальные стили
                newBtn.style.cursor = 'pointer';
                newBtn.style.transition = 'all 0.2s ease';
                
                newBtn.addEventListener('mouseenter', () => {
                    newBtn.style.transform = 'scale(1.1)';
                    newBtn.style.opacity = '0.8';
                });
                
                newBtn.addEventListener('mouseleave', () => {
                    newBtn.style.transform = 'scale(1)';
                    newBtn.style.opacity = '1';
                });
            }
        };
    
        // Пробуем сразу
        setupHandler();
        
        // И через задержку на случай если DOM еще не готов
        setTimeout(setupHandler, 500);
        setTimeout(setupHandler, 1000);
    }

    private setupModalListeners(): void {
        const modal = document.getElementById('groupModal');
        const closeBtn = modal?.querySelector('.group-close-btn') as HTMLButtonElement;
        const cancelBtn = modal?.querySelector('.group-cancel-btn') as HTMLButtonElement;
        const createBtn = modal?.querySelector('.group-create-btn') as HTMLButtonElement;
        const groupNameInput = document.getElementById('groupName') as HTMLInputElement;
        const userSearchInput = document.getElementById('userSearch') as HTMLInputElement;
        const resultsContainer = document.getElementById('usersSearchResults');

        // Убедитесь, что элементы существуют
        if (!modal || !closeBtn || !cancelBtn || !createBtn || !groupNameInput || !userSearchInput || !resultsContainer) {
            console.error('❌ GroupManager: Some modal elements not found!');
            return;
        }

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
        if (!resultsContainer) {
            console.error('❌ GroupManager: usersSearchResults container not found');
            return;
        }
    
        if (!query || query.length < 2) {
            resultsContainer.classList.add('hidden');
            return;
        }
    
        // Показываем индикатор загрузки
        resultsContainer.innerHTML = `
            <div class="search-loading">
                <div class="loading-spinner"></div>
                <p>Поиск пользователей...</p>
            </div>
        `;
        resultsContainer.classList.remove('hidden');
    
        try {
            const users = await this.api.searchUsers(query);
            
            if (users && Array.isArray(users)) {
                // ФИЛЬТРУЕМ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ ИЗ РЕЗУЛЬТАТОВ
                const filteredUsers = users.filter(user => {
                    const isCurrentUser = this.currentUser && user.id === this.currentUser.id;
                    return !isCurrentUser;
                });
                
                this.renderUserSearchResults(filteredUsers);
            } else {
                console.error('❌ GroupManager: Invalid users data:', users);
                this.renderUserSearchResults([]);
            }
        } catch (error) {
            console.error('❌ GroupManager: User search failed:', error);
            resultsContainer.innerHTML = `
                <div class="search-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Ошибка при поиске пользователей</p>
                </div>
            `;
            resultsContainer.classList.remove('hidden');
        }
    }

    private renderUserSearchResults(users: User[]): void {
        const resultsContainer = document.getElementById('usersSearchResults');
        if (!resultsContainer) {
            console.error('❌ GroupManager: resultsContainer not found in renderUserSearchResults');
            return;
        }
    
        if (users.length > 0) {
            const usersHTML = users.map(user => `
                <div class="user-search-result" data-user-id="${user.id}">
                    <div class="user-avatar">
                        <img src="${user.avatar_url || user.avatar || user.url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=40&h=40&fit=crop&crop=face'}" 
                             alt="${user.name}"
                             class="user-avatar-img">
                    </div>
                    <div class="user-info">
                        <div class="user-name">${this.escapeHtml(user.name || 'Без имени')}</div>
                        <div class="user-username">@${this.escapeHtml(user.username || 'user')}</div>
                    </div>
                    <button class="add-user-btn" title="Добавить">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            `).join('');
    
            resultsContainer.innerHTML = `
                <div class="users-list">
                    ${usersHTML}
                </div>
            `;
    
            // Добавляем обработчики событий
            const addButtons = resultsContainer.querySelectorAll('.add-user-btn');
            
            addButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const userResult = (e.target as HTMLElement).closest('.user-search-result');
                    if (userResult) {
                        const userId = parseInt(userResult.getAttribute('data-user-id')!);
                        this.addUserToSelection(userId, userResult);
                    }
                });
            });
    
            const resultItems = resultsContainer.querySelectorAll('.user-search-result');
            
            resultItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    const userId = parseInt(item.getAttribute('data-user-id')!);
                    this.addUserToSelection(userId, item);
                });
            });
        } else {
            resultsContainer.innerHTML = `
                <div class="search-empty">
                    <i class="fas fa-user-slash"></i>
                    <p>Пользователи не найдены</p>
                </div>
            `;
        }
    
        resultsContainer.classList.remove('hidden');
    }

    private addUserToSelection(userId: number, userElement: Element): void {
        const selectedUsersContainer = document.getElementById('selectedUsers');
        if (!selectedUsersContainer) {
            console.error('❌ GroupManager: selectedUsers container not found');
            return;
        }
    
        const existingUser = selectedUsersContainer.querySelector(`[data-user-id="${userId}"]`);
        if (existingUser) {
            return;
        }
    
        const userName = userElement.querySelector('.user-name')?.textContent || 'Пользователь';
        const userAvatar = userElement.querySelector('.user-avatar img')?.getAttribute('src') || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=40&h=40&fit=crop&crop=face';
    
        // УДАЛЯЕМ ВСЕ empty states ПРИ ДОБАВЛЕНИИ ПЕРВОГО ПОЛЬЗОВАТЕЛЯ
        const emptyStates = selectedUsersContainer.querySelectorAll('.selected-users-empty');
        emptyStates.forEach(emptyState => {
            emptyState.remove();
        });
    
        const userChip = document.createElement('div');
        userChip.className = 'selected-user-chip';
        userChip.setAttribute('data-user-id', userId.toString());
        userChip.innerHTML = `
            <img src="${userAvatar}" alt="${userName}" 
                 class="selected-user-avatar"
                 style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
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
        
        // ПОЛНОСТЬЮ ОЧИЩАЕМ КОНТЕЙНЕР ПЕРЕД ДОБАВЛЕНИЕМ empty state
        if (selectedUsers.length === 0) {
            selectedUsersContainer.innerHTML = ''; // Очищаем полностью
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
        
        if (!modal) {
            console.error('❌ GroupManager: groupModal not found in DOM!');
            return;
        }
        
        const groupNameInput = document.getElementById('groupName') as HTMLInputElement;
        
        if (modal && groupNameInput) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            groupNameInput.focus();
            this.resetForm();
        } else {
            console.error('❌ GroupManager: Failed to open modal - elements not found');
        }
    }

    public closeGroupCreation(): void {
        const modal = document.getElementById('groupModal');
        
        if (modal) {
            modal.classList.add('hidden');
            this.resetForm();
        }
    }

    private resetForm(): void {
        const groupNameInput = document.getElementById('groupName') as HTMLInputElement;
        const userSearchInput = document.getElementById('userSearch') as HTMLInputElement;
        const resultsContainer = document.getElementById('usersSearchResults');
        const selectedUsersContainer = document.getElementById('selectedUsers');
        
        if (groupNameInput) groupNameInput.value = '';
        if (userSearchInput) userSearchInput.value = '';
        if (resultsContainer) {
            resultsContainer.classList.add('hidden');
        }
        if (selectedUsersContainer) {
            // ПОЛНОСТЬЮ СБРАСЫВАЕМ ВЫБРАННЫХ ПОЛЬЗОВАТЕЛЕЙ
            selectedUsersContainer.innerHTML = `
                <div class="selected-users-empty">
                    <i class="fas fa-user-plus"></i>
                    <span>Пока нет выбранных пользователей</span>
                </div>
            `;
        }
    
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