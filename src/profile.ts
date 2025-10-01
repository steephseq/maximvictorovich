import { ProfileAPI } from './api.js';
import type { Chat, User, GroupProfile } from './types.js';

class ProfileManager {
    private api: ProfileAPI;
    private currentProfile: GroupProfile | User | null = null;
    private isGroup: boolean = false;
    private currentChatId: number = 0;

    constructor() {
        this.api = new ProfileAPI();
        this.setupEventListeners();
    }

    async init(chatData: Chat) {
        try {
            this.isGroup = chatData.is_group;
            this.currentChatId = chatData.id;
            this.currentProfile = await this.api.fetchProfile(chatData);
            this.renderProfile();
        } catch (error) {
            this.showError('Ошибка загрузки профиля');
        }
    }

    private renderProfile() {
        if (!this.currentProfile) return;

        this.setText('profileName', this.currentProfile.name);
        if (this.currentProfile.avatar_url) {
            this.setImage('profileAvatar', this.currentProfile.avatar_url);
        }
        
        if (this.currentProfile.bio) {
            this.showElement('bioSection');
            this.setText('profileBio', this.currentProfile.bio);
        } else {
            this.hideElement('bioSection');
        }

        if (this.isGroup) {
            this.renderGroupProfile(this.currentProfile as GroupProfile);
        } else {
            this.renderUserProfile(this.currentProfile as User);
        }
    }

    private renderGroupProfile(profile: GroupProfile) {
        this.showElement('groupInfo');
        this.showElement('membersSection');
        this.showElement('groupActions');
        this.showElement('editBtn');
        this.hideElement('messageBtn');
        
        this.setText('memberCount', `${profile.count_members} участников`);
        this.renderMembers(profile.members);
    }

    private renderUserProfile(profile: User) {
        this.showElement('userInfo');
        this.showElement('messageBtn');
        this.hideElement('groupInfo');
        this.hideElement('membersSection');
        this.hideElement('groupActions');
        this.hideElement('editBtn');
        
        this.setText('userUsername', `@${profile.username}`);
    }

    private renderMembers(members: User[]) {
        const container = document.getElementById('membersList');
        if (!container) return;

        container.innerHTML = members.map(member => `
            <div class="member-card" data-user-id="${member.id}">
                <div class="member-info">
                    <img src="${member.avatar_url || 'default-avatar.jpg'}" 
                        alt="${member.name}" 
                        class="member-avatar">
                    <span class="member-name">${member.name}</span>
                </div>
                <div class="member-actions">
                    <button class="action-btn btn-message" data-action="message" data-user-id="${member.id}">
                        <i class="fas fa-comment"></i>
                    </button>
                    <button class="action-btn btn-remove" data-action="remove" data-user-id="${member.id}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    private setupEventListeners() {
        document.getElementById('addMemberBtn')?.addEventListener('click', () => this.showSearchModal());
        document.getElementById('messageBtn')?.addEventListener('click', () => this.messageUser());
        
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const button = target.closest('[data-action]') as HTMLElement;
            
            if (!button) return;
            
            const action = button.dataset.action;
            const userId = parseInt(button.dataset.userId || '0');
            
            if (action === 'message') this.messageUser(userId);
            if (action === 'remove') this.removeMember(userId);
        });
    }

    private async showSearchModal() {
        const query = prompt('Введите имя пользователя для поиска:');
        if (!query) return;

        try {
            const users = await this.api.searchUsers(query);
            if (users.length > 0) {
                const userList = users.map(u => `${u.name} (@${u.username})`).join('\n');
                const selected = prompt(`Найдены пользователи:\n${userList}\n\nВведите ID пользователя для добавления:`);
                const userId = parseInt(selected || '0');
                
                if (userId && users.some(u => u.id === userId)) {
                    if (confirm(`Добавить пользователя в группу?`)) {
                        const result = await this.api.addUsersToChat(this.currentChatId, [userId]);
                        alert(`Добавлено: ${result.added.length}, уже в группе: ${result.alreadyExists.length}`);
                        this.reloadProfile();
                    }
                }
            } else {
                alert('Пользователи не найдены');
            }
        } catch (error) {
            this.showError('Ошибка при поиске пользователей');
        }
    }

    private messageUser(userId?: number) {
        console.log('Написать пользователю:', userId || (this.currentProfile as User)?.id);
    }

    private async removeMember(userId: number) {
        if (!confirm('Вы уверены, что хотите удалить участника?')) return;
        
        try {
            const removedUsers = await this.api.removeUserFromChat(this.currentChatId, [userId]);
            if (removedUsers.includes(userId)) {
                alert('Пользователь удален из группы');
                this.reloadProfile();
            }
        } catch (error) {
            this.showError('Ошибка при удалении пользователя');
        }
    }

    // В методе reloadProfile или подобных местах
private reloadProfile() {
    this.init({
        id: this.currentChatId,
        name: '',
        is_group: true
        // updated_at не обязателен
    } as Chat); // ← можно добавить as Chat если TypeScript ругается
}

    private showElement(id: string) {
        document.getElementById(id)?.classList.remove('hidden');
    }

    private hideElement(id: string) {
        document.getElementById(id)?.classList.add('hidden');
    }

    private setText(id: string, text: string) {
        const element = document.getElementById(id);
        if (element) element.textContent = text;
    }

    private setImage(id: string, src: string) {
        const img = document.getElementById(id) as HTMLImageElement;
        if (img) img.src = src;
    }

    private showError(message: string) {
        alert(message);
    }
}

// Инициализация
const profileManager = new ProfileManager();

// Загрузка параметров из URL
const urlParams = new URLSearchParams(window.location.search);
const chatId = parseInt(urlParams.get('chatId') || '1');
const isGroup = urlParams.get('type') === 'group';

document.addEventListener('DOMContentLoaded', () => {
    profileManager.init({
        id: chatId,
        name: '',
        is_group: isGroup
    });
});