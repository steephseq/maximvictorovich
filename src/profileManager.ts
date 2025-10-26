import { ProfileAPI } from './api.js';
import { User, GroupProfile, Chat } from './types.js';
import { GroupManager } from './groupManager.js';

export class ProfileManager {
    private api: ProfileAPI;
    private groupManager: GroupManager;
    private currentUser: User | null = null;
    private currentChat: Chat | null = null;

    constructor(api: ProfileAPI, groupManager: GroupManager) {
        this.api = api;
        this.groupManager = groupManager;
    }

    setCurrentUser(user: User): void {
        this.currentUser = user;
    }

    setCurrentChat(chat: Chat): void {
        this.currentChat = chat;
    }

    async openOtherUserProfile(): Promise<void> {
        if (!this.currentChat) {
            return;
        }
        
        try {
            const profile = await this.api.fetchProfile(this.currentChat);
            
            if (this.currentChat.is_group) {
                if (this.groupManager) {
                    this.groupManager.setCurrentChatId(this.currentChat.id);
                }
                this.showGroupProfileModal(profile as GroupProfile);
            } else {
                this.showProfileModal(profile as User);
            }
        } catch (error) {
            console.error('Failed to fetch profile:', error);
            this.showError('Не удалось загрузить профиль.');
        }
    }

    openMyProfile(): void {
        if (this.currentUser) {
            this.showProfileModal(this.currentUser);
        }
    }

    showProfileModal(user: User | null): void {
        const modal = document.getElementById('profileModal');
        if (!modal || !user) {
            console.error('❌ Profile modal or user not found');
            return;
        }
    
        this.resetModalState('profileModal');
    
        const modalTitle = document.getElementById('profileModalTitle') as HTMLElement;
        if (modalTitle) {
            modalTitle.textContent = user.id === this.currentUser?.id ? 'Мой профиль' : `Профиль ${user.name}`;
        }
    
        const displayName = document.getElementById('profileDisplayName') as HTMLElement;
        const displayUsername = document.getElementById('profileDisplayUsername') as HTMLElement;
        const displayBio = document.getElementById('profileDisplayBio') as HTMLElement;
        
        if (displayName) displayName.textContent = user.name || 'Без имени';
        if (displayUsername) displayUsername.textContent = `@${user.username || 'user'}`;
        if (displayBio) displayBio.textContent = user.bio || 'Нет описания';
    
        const avatarImg = document.getElementById('profileModalAvatar') as HTMLImageElement;
        if (avatarImg) {
            const avatarUrl = user.avatar_url || user.avatar || user.url;
            avatarImg.src = avatarUrl || 'https://via.placeholder.com/120';
            avatarImg.onerror = () => {
                avatarImg.src = 'https://via.placeholder.com/120';
            };
        }
    
        const profileView = document.getElementById('profileView');
        const profileEditForm = document.getElementById('profileEditForm');
        const editBtn = document.getElementById('editProfileBtn');
    
        if (profileView) profileView.classList.remove('hidden');
        if (profileEditForm) profileEditForm.classList.add('hidden');
        if (editBtn) editBtn.style.display = user.id === this.currentUser?.id ? 'block' : 'none';
    
        setTimeout(() => {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        }, 10);
    }

    showGroupProfileModal(profile: GroupProfile): void {
        const modal = document.getElementById('groupProfileModal');
        if (!modal) {
            console.error('❌ groupProfileModal not found');
            return;
        }
    
        this.resetModalState('groupProfileModal');
    
        // Устанавливаем обработчики
        this.setupGroupProfileModalHandlers();
        if (this.groupManager && this.currentChat) {
            this.groupManager.setCurrentChatId(this.currentChat.id);
        }
    
        const titleElement = document.getElementById('groupProfileModalTitle');
        if (titleElement) {
            titleElement.textContent = profile.name || 'Группа без названия';
        }
        
        const avatarImg = document.getElementById('groupProfileModalAvatar') as HTMLImageElement;
        if (avatarImg) {
            const avatarUrl = profile.avatar_url || profile.avatar || 
                             (profile as any).AvatarURL || (profile as any).avatar_url || 
                             'https://via.placeholder.com/120';
            avatarImg.src = avatarUrl;
            avatarImg.onerror = () => {
                avatarImg.src = 'https://via.placeholder.com/120';
            };
        }
        
        const nameInput = document.getElementById('groupProfileName') as HTMLInputElement;
        const bioTextarea = document.getElementById('groupProfileBio') as HTMLTextAreaElement;
        if (nameInput) nameInput.value = profile.name || '';
        if (bioTextarea) bioTextarea.value = profile.bio || '';
    
        const memberCountElement = document.getElementById('groupMemberCount');
        if (memberCountElement) {
            const memberCount = profile.count_members || (profile.members ? profile.members.length : 0);
            memberCountElement.textContent = memberCount.toString();
        }
    
        const membersList = document.getElementById('groupMembersList');
        if (membersList) {
            membersList.innerHTML = '';
            
            if (!profile.members || profile.members.length === 0) {
                membersList.innerHTML = '<div class="text-gray-500 text-center p-4">Нет участников</div>';
            } else {
                profile.members.forEach((member: any, index: number) => {
                    const memberId = member.id || member.ID || index;
                    const memberName = member.name || member.Name || 'Без имени';
                    const memberUsername = member.username || member.UserName || member.userName || 'user';
                    const avatarUrl = member.avatar_url || member.avatar || member.url || 
                                    member.AvatarURL || member.Avatar || member.URL ||
                                    'https://via.placeholder.com/40';
                    const isOnline = Boolean(member.is_online || member.IsOnline || member.online);
                    
                    // Правильно обрабатываем префикс (может быть sql.NullString объектом)
                    let adminTitle = '';
                    if (member.title) {
                        if (typeof member.title === 'string') {
                            adminTitle = member.title;
                        } else if (member.title.Valid !== undefined && member.title.String !== undefined) {
                            // Это sql.NullString объект
                            adminTitle = member.title.Valid ? member.title.String : '';
                        } else if (member.title.valid !== undefined && member.title.string !== undefined) {
                            // Альтернативный вариант названий полей
                            adminTitle = member.title.valid ? member.title.string : '';
                        }
                    } else if (member.AdminTitle) {
                        if (typeof member.AdminTitle === 'string') {
                            adminTitle = member.AdminTitle;
                        } else if (member.AdminTitle.Valid !== undefined && member.AdminTitle.String !== undefined) {
                            adminTitle = member.AdminTitle.Valid ? member.AdminTitle.String : '';
                        }
                    } else if (member.admin_title) {
                        if (typeof member.admin_title === 'string') {
                            adminTitle = member.admin_title;
                        } else if (member.admin_title.Valid !== undefined && member.admin_title.String !== undefined) {
                            adminTitle = member.admin_title.Valid ? member.admin_title.String : '';
                        }
                    }
    
                    const memberElement = document.createElement('div');
                    memberElement.className = 'member-item';
                    memberElement.setAttribute('data-user-id', memberId.toString());
                    
                    memberElement.innerHTML = `
                        <div class="member-item-wrapper">
                            <div class="member-left-area" data-action="profile">
                                <div class="member-avatar-container ${isOnline ? 'online' : ''}">
                                    <img src="${avatarUrl}" alt="${memberName}" class="member-avatar"
                                         onerror="this.src='https://via.placeholder.com/40'">
                                </div>
                                <div class="member-details">
                                    <span class="member-name">${this.escapeHtml(memberName)}</span>
                                    <span class="member-username">@${this.escapeHtml(memberUsername)}</span>
                                    ${adminTitle ? `<span class="member-admin-title">${this.escapeHtml(adminTitle)}</span>` : ''}
                                </div>
                            </div>
                            <div class="member-right-area" data-action="menu">
                                <button class="member-actions-trigger" title="Действия" data-user-id="${memberId}">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                            </div>
                        </div>
                    `;
                    
                    const rightArea = memberElement.querySelector('.member-right-area') as HTMLElement;
                    if (rightArea) {
                        rightArea.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (this.groupManager && this.currentChat) {
                                this.groupManager.showUserActions(this.currentChat.id, member);
                            }
                        });
                    }
                    
                    const leftArea = memberElement.querySelector('.member-left-area') as HTMLElement;
                    if (leftArea) {
                        leftArea.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.showUserProfileModal(member);
                        });
                    }
                    
                    membersList.appendChild(memberElement);
                });
            }
        }
    
    
        const editBtn = document.getElementById('editGroupProfileBtn');
        const addMemberBtn = document.getElementById('addGroupMemberBtn');
        const leaveGroupBtn = document.getElementById('leaveGroupBtn');
        
        if (editBtn) editBtn.style.display = profile.is_admin ? 'block' : 'none';
        if (addMemberBtn) addMemberBtn.style.display = profile.is_admin ? 'block' : 'none';
        
        if (leaveGroupBtn) {
            leaveGroupBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.groupManager.leaveGroup(); // БЕЗ АРГУМЕНТА
            };
        }
        setTimeout(() => {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        }, 10);
    }

    showUserProfileModal(user: any): void {
        const modal = document.getElementById('userProfileModal');
        if (!modal) {
            console.error('❌ userProfileModal not found');
            return;
        }
    
        this.resetModalState('userProfileModal');
    
        const titleElement = document.getElementById('userProfileModalTitle');
        if (titleElement) {
            titleElement.textContent = user.name || 'Пользователь без имени';
        }
        
        const avatarImg = document.getElementById('userProfileModalAvatar') as HTMLImageElement;
        if (avatarImg) {
            const avatarUrl = user.avatar_url || user.avatar || user.url || 
                             user.AvatarURL || user.Avatar || user.URL ||
                             'https://via.placeholder.com/120';
            avatarImg.src = avatarUrl;
            avatarImg.onerror = () => {
                avatarImg.src = 'https://via.placeholder.com/120';
            };
        }
        
        const nameElement = document.getElementById('userProfileName');
        const usernameElement = document.getElementById('userProfileUsername');
        const bioElement = document.getElementById('userProfileBio');
        
        if (nameElement) nameElement.textContent = user.name || 'Без имени';
        if (usernameElement) usernameElement.textContent = `@${user.username || user.userName || 'user'}`;
        if (bioElement) bioElement.textContent = user.bio || 'Нет описания';
    
        setTimeout(() => {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        }, 10);
    }

    setupProfileModalHandlers(): void {
        const modal = document.getElementById('profileModal');
        if (!modal) return;
    
        const closeBtn = modal.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeModal('profileModal');
            });
        }
    
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal('profileModal');
            }
        });
    }

    setupGroupProfileModalHandlers(): void {
        const modal = document.getElementById('groupProfileModal');
        if (!modal) return;
    
        // Обработчик для крестика
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeModal('groupProfileModal');
            });
        }
    
        // Обработчик для кнопки "Закрыть"
        const cancelBtn = document.getElementById('cancelGroupProfileBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeModal('groupProfileModal');
            });
        }
    
        // Обработчик для клика по overlay
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal('groupProfileModal');
            }
        });
    
        // Обработчик для клавиши Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                this.closeModal('groupProfileModal');
            }
        });
    }

    setupChatHeaderClickHandlers(): void {
        const chatHeader = document.querySelector('.chat-header-info');
        if (chatHeader) {
            const newChatHeader = chatHeader.cloneNode(true) as HTMLElement;
            chatHeader.parentNode?.replaceChild(newChatHeader, chatHeader);
            
            newChatHeader.addEventListener('click', () => {
                this.openOtherUserProfile();
            });
        }
    }

    private resetModalState(modalId: string): void {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        modal.classList.add('hidden');
        modal.style.display = 'none';
        
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }, 0);
    }

    private closeModal(modalId: string): void {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    private showError(message: string): void {
        console.error('❌ Error:', message);
        alert(message);
    }
}