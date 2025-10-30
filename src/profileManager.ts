import { ProfileAPI } from './api.js';
import { User, GroupProfile, Chat } from './types.js';
import { GroupManager } from './groupManager.js';
import { profileWebSocket } from './websocket.js';

export class ProfileManager {
    private api: ProfileAPI;
    private groupManager: GroupManager;
    private currentUser: User | null = null;
    private currentChat: Chat | null = null;
    private profileWS: any = null;
    private shouldReconnect = false;
    private currentProfileWSListener: ((data: any) => void) | null = null;

    constructor(api: ProfileAPI, groupManager: GroupManager) {
        this.api = api;
        this.groupManager = groupManager;
        
        this.setupProfileUpdateListener();
        setTimeout(() => {
            this.setupProfileModalHandlers();
            this.setupAvatarUploadHandlers();
            this.setupProfileModalCloseHandlers();
            this.setupGroupProfileModalHandlers();
            
            setTimeout(() => this.setupSidebarUserClickHandler(), 200);
        }, 100);
    }

    setCurrentUser(user: User): void {
        this.currentUser = user;
    }

    setCurrentChat(chat: Chat): void {
        this.currentChat = chat;
    }

    private setupProfileUpdateListener(): void {
        // Обработчик для полных обновлений профиля
        document.addEventListener('profileUpdated', ((e: CustomEvent<any>) => {
            console.log('🔄 Full profile update received:', e.detail);
            this.refreshOpenProfileModal(e.detail);
        }) as EventListener);
    
        // 🔴 УЛУЧШЕННЫЙ ОБРАБОТЧИК ДЛЯ СТАТУСОВ
        document.addEventListener('profileStatusUpdate', ((e: CustomEvent<any>) => {
            console.log('🔄 Profile status update received:', e.detail);
            this.handleProfileStatusUpdate(e.detail.data, e.detail.chatId);
        }) as EventListener);
    
        // 🔴 ОБРАБОТЧИК ДЛЯ ОБНОВЛЕНИЙ ГРУППЫ
        document.addEventListener('groupProfileUpdate', ((e: CustomEvent<any>) => {
            console.log('🔄 Group profile update received:', e.detail);
            this.refreshOpenProfileModal(e.detail);
        }) as EventListener);
    }

    private handleProfileStatusUpdate(statusData: any, chatId: number): void {
        console.log('🔄 Handling profile status update for chat:', chatId, statusData);
        
        // Обновляем статусы во всех открытых модалках
        this.updateAllOpenModalsWithStatus(statusData);
    }

    private updateAllOpenModalsWithStatus(statusData: any): void {
        // Для группового профиля
        const groupModal = document.getElementById('groupProfileModal');
        if (groupModal && !groupModal.classList.contains('hidden')) {
            this.updateGroupMembersStatus(statusData);
        }
        
        // Для пользовательского профиля
        const userModal = document.getElementById('userProfileModal');
        if (userModal && !userModal.classList.contains('hidden')) {
            this.updateUserProfileStatus(statusData);
        }
    }

    private updateProfileStatus(statusData: any, chatId: number): void {
        console.log('🔄 Updating profile status for chat:', chatId, statusData);
        
        // Просто используем существующий метод обновления профиля
        this.refreshOpenProfileModal(statusData);
    }

    private updateGroupMembersStatus(statusData: any): void {
        const membersList = document.getElementById('groupMembersList');
        if (!membersList) return;
        
        // Если пришел полный объект пользователя
        if (statusData.user_id || statusData.id) {
            const userId = statusData.user_id || statusData.id;
            const isOnline = Boolean(statusData.is_online || statusData.online);
            
            console.log(`🔄 Updating member ${userId} status to:`, isOnline ? 'online' : 'offline');
            
            // Находим элемент участника и обновляем статус
            const memberElement = membersList.querySelector(`[data-user-id="${userId}"]`);
            if (memberElement) {
                const avatarContainer = memberElement.querySelector('.member-avatar-container');
                if (avatarContainer) {
                    if (isOnline) {
                        avatarContainer.classList.add('online');
                    } else {
                        avatarContainer.classList.remove('online');
                    }
                }
            }
        }
        // Если пришел массив статусов
        else if (statusData.members && Array.isArray(statusData.members)) {
            statusData.members.forEach((member: any) => {
                const userId = member.id || member.user_id;
                const isOnline = Boolean(member.is_online || member.online);
                
                const memberElement = membersList.querySelector(`[data-user-id="${userId}"]`);
                if (memberElement) {
                    const avatarContainer = memberElement.querySelector('.member-avatar-container');
                    if (avatarContainer) {
                        if (isOnline) {
                            avatarContainer.classList.add('online');
                        } else {
                            avatarContainer.classList.remove('online');
                        }
                    }
                }
            });
        }
    }

    private updateUserProfileStatus(statusData: any): void {
        // Если это обновление конкретного пользователя
        if (statusData.user_id || statusData.id) {
            const userId = statusData.user_id || statusData.id;
            const isOnline = Boolean(statusData.is_online || statusData.online);
            
            // Проверяем, что это тот же пользователь, чей профиль открыт
            const currentProfile = this.getCurrentOpenProfile();
            if (currentProfile && (currentProfile.id === userId || currentProfile.user_id === userId)) {
                const onlineIndicator = document.querySelector('.user-online-status');
                if (onlineIndicator) {
                    onlineIndicator.textContent = isOnline ? '🟢 В сети' : '⚪ Не в сети';
                }
            }
        }
    }

    private getCurrentOpenProfile(): any {
        const userModal = document.getElementById('userProfileModal');
        if (userModal && !userModal.classList.contains('hidden')) {
            // Здесь можно получить данные из открытой модалки
            const nameElement = document.getElementById('userProfileName');
            if (nameElement) {
                // Вернуть заглушку или реализовать получение данных
                return { id: 0 }; // Заглушка
            }
        }
        return null;
    }
    
    private refreshOpenProfileModal(updatedProfile: any): void {
        console.log('🔄 Refreshing profile modal with:', updatedProfile);
        
        const groupModal = document.getElementById('groupProfileModal');
        if (groupModal && !groupModal.classList.contains('hidden')) {
            console.log('🔄 Updating open group profile modal');
            this.showGroupProfileModal(updatedProfile);
        }
        
        const userModal = document.getElementById('userProfileModal');
        if (userModal && !userModal.classList.contains('hidden')) {
            console.log('🔄 Updating open user profile modal');
            this.showUserProfileModal(updatedProfile);
        }
        
        const profileModal = document.getElementById('profileModal');
        if (profileModal && !profileModal.classList.contains('hidden')) {
            console.log('🔄 Updating open personal profile modal');
            // Для личного профиля может потребоваться другая логика
        }
    }

    private async uploadAvatar(file: File, isGroup: boolean = false): Promise<void> {
        if (!this.currentUser && !isGroup) {
            this.showError('Пользователь не найден');
            return;
        }
    
        if (file.size > 5 * 1024 * 1024) {
            this.showError('Размер файла не должен превышать 5MB');
            return;
        }
    
        if (!file.type.startsWith('image/')) {
            this.showError('Пожалуйста, выберите изображение');
            return;
        }
    
        try {
            const ownerId = isGroup ? this.currentChat?.id : this.currentUser?.id;
            if (!ownerId) {
                throw new Error('ID владельца не найден');
            }
    
            this.showAvatarUploadProgress(true, isGroup);
    
            const avatarUrl = await this.api.setAvatar(file, ownerId, isGroup);
    
            if (isGroup) {
                const avatarImg = document.getElementById('groupProfileModalAvatar') as HTMLImageElement;
                if (avatarImg) {
                    avatarImg.src = avatarUrl;
                }
                if (this.currentChat) {
                    this.currentChat.avatar_url = avatarUrl;
                }
            } else {
                const avatarImg = document.getElementById('profileModalAvatar') as HTMLImageElement;
                if (avatarImg) {
                    avatarImg.src = avatarUrl;
                }
                if (this.currentUser) {
                    this.currentUser.avatar_url = avatarUrl;
                    this.updateSidebarUserInfo();
                }
            }
    
            this.showSuccess('Аватар успешно обновлен');
            
        } catch (error) {
            console.error('❌ Failed to upload avatar:', error);
            this.showError('Не удалось загрузить аватар');
        } finally {
            this.showAvatarUploadProgress(false, isGroup);
        }
    }

    private showAvatarUploadProgress(show: boolean, isGroup: boolean): void {
        const uploadBtn = isGroup 
            ? document.getElementById('uploadGroupAvatarBtn')
            : document.getElementById('uploadProfileAvatarBtn');
        
        const avatarImg = isGroup
            ? document.getElementById('groupProfileModalAvatar')
            : document.getElementById('profileModalAvatar');
    
        if (uploadBtn) {
            if (show) {
                uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';
                uploadBtn.setAttribute('disabled', 'true');
            } else {
                uploadBtn.innerHTML = '<i class="fas fa-camera"></i> Сменить аватар';
                uploadBtn.removeAttribute('disabled');
            }
        }
    
        if (avatarImg) {
            if (show) {
                avatarImg.classList.add('avatar-loading');
            } else {
                avatarImg.classList.remove('avatar-loading');
            }
        }
    }
    
    private setupAvatarUploadHandlers(): void {
        const userAvatarInput = document.getElementById('profileAvatarInput') as HTMLInputElement;
        const userAvatarUploadBtn = document.getElementById('uploadProfileAvatarBtn');
        
        if (userAvatarUploadBtn && userAvatarInput) {
            userAvatarUploadBtn.addEventListener('click', () => {
                userAvatarInput.click();
            });
            
            userAvatarInput.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                if (target.files && target.files[0]) {
                    this.uploadAvatar(target.files[0], false);
                }
            });
        }
    
        const groupAvatarInput = document.getElementById('groupAvatarInput') as HTMLInputElement;
        const groupAvatarUploadBtn = document.getElementById('uploadGroupAvatarBtn');
        
        if (groupAvatarUploadBtn && groupAvatarInput) {
            groupAvatarUploadBtn.addEventListener('click', () => {
                groupAvatarInput.click();
            });
            
            groupAvatarInput.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                if (target.files && target.files[0]) {
                    this.uploadAvatar(target.files[0], true);
                }
            });
        }
    }

    async openOtherUserProfile(): Promise<void> {
        console.log('🎯 openOtherUserProfile called for chat:', this.currentChat?.id);
        
        if (!this.currentChat) {
            console.log('❌ No current chat');
            return;
        }
        
        try {
            const profile = await this.api.fetchProfile(this.currentChat);
            console.log('✅ Profile fetched:', profile);
            
            // Показываем профиль
            if (this.currentChat.is_group) {
                if (this.groupManager) {
                    this.groupManager.setCurrentChatId(this.currentChat.id);
                }
                this.showGroupProfileModal(profile as GroupProfile);
            } else {
                this.showProfileModal(profile as User);
            }
            
            // 🔴 УЛУЧШЕННОЕ ПОДКЛЮЧЕНИЕ WebSocket
            console.log(`🟢 Connecting to profile WebSocket for chat ${this.currentChat.id}`);
            
            const messageHandler = (data: any) => {
                console.log('📨 Profile WebSocket message received in manager:', data);
                
                if (data.type === 'profile_update' || data.type === 'profile:update') {
                    console.log('🔄 Profile update from WebSocket:', data.content);
                    this.refreshOpenProfileModal(data.content);
                }
                // 🔴 ОБРАБАТЫВАЕМ СТАТУСЫ
                else if (data.type === 'status_update' || data.type === 'user_status_update') {
                    console.log('🔄 Status update from WebSocket:', data);
                    const statusEvent = new CustomEvent('profileStatusUpdate', { 
                        detail: {
                            data: data.data || data.content,
                            chatId: this.currentChat?.id
                        }
                    });
                    document.dispatchEvent(statusEvent);
                }
            };
            
            profileWebSocket.addMessageListener(messageHandler);
            profileWebSocket.connectToProfile(this.currentChat.id);
            
            this.currentProfileWSListener = messageHandler;
            
        } catch (error) {
            console.error('❌ Failed to fetch profile:', error);
            this.showError('Не удалось загрузить профиль.');
        }
    }

    openMyProfile(): void {
        // 🔴 Для своего профиля закрываем вебсокет (если был открыт чужой)
        this.disconnectProfileWS();
        
        if (this.currentUser) {
            this.showProfileModal(this.currentUser, true);
        } else {
            console.error('❌ Cannot open profile: current user is null');
            this.showError('Не удалось загрузить профиль пользователя');
        }
    }

    async showProfileModal(user: User | null, openInEditMode: boolean = false): Promise<void> {
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
    
        const nameInput = document.getElementById('profileName') as HTMLInputElement;
        const usernameInput = document.getElementById('profileUsername') as HTMLInputElement;
        const bioTextarea = document.getElementById('profileBio') as HTMLTextAreaElement;
        
        if (nameInput) nameInput.value = user.name || '';
        if (usernameInput) usernameInput.value = user.username || '';
        if (bioTextarea) bioTextarea.value = user.bio || '';
    
        const avatarImg = document.getElementById('profileModalAvatar') as HTMLImageElement;
        if (avatarImg) {
            const avatarUrl = user.avatar_url || user.avatar || user.url;
            avatarImg.src = avatarUrl || 'https://via.placeholder.com/120';
            avatarImg.onerror = () => {
                avatarImg.src = 'https://via.placeholder.com/120';
            };
        }
    
        const isOwnProfile = user.id === this.currentUser?.id;
        const uploadAvatarBtn = document.getElementById('uploadProfileAvatarBtn');
        const avatarInput = document.getElementById('profileAvatarInput') as HTMLInputElement;
    
        if (uploadAvatarBtn && avatarInput) {
            if (isOwnProfile) {
                uploadAvatarBtn.style.display = 'block';
                
                uploadAvatarBtn.replaceWith(uploadAvatarBtn.cloneNode(true));
                avatarInput.replaceWith(avatarInput.cloneNode(true));
                
                const newUploadBtn = document.getElementById('uploadProfileAvatarBtn');
                const newAvatarInput = document.getElementById('profileAvatarInput') as HTMLInputElement;
                
                if (newUploadBtn && newAvatarInput) {
                    newUploadBtn.addEventListener('click', () => {
                        newAvatarInput.click();
                    });
                    
                    newAvatarInput.addEventListener('change', (e) => {
                        const target = e.target as HTMLInputElement;
                        if (target.files && target.files[0]) {
                            this.uploadAvatar(target.files[0], false);
                            target.value = '';
                        }
                    });
                }
            } else {
                uploadAvatarBtn.style.display = 'none';
            }
        }
    
        const editBtn = document.getElementById('editProfileBtn');
        const isOwnProfileFinal = user.id === this.currentUser?.id;
        
        if (isOwnProfileFinal) {
            if (editBtn) editBtn.style.display = 'block';
            
            if (openInEditMode) {
                this.switchToEditMode();
            } else {
                this.switchToViewMode();
            }
        } else {
            if (editBtn) editBtn.style.display = 'none';
            this.switchToViewMode();
        }
    
        this.setupProfileModalCloseHandlers();
    
        setTimeout(() => {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        }, 10);
    }

    private switchToViewMode(): void {
        const profileView = document.getElementById('profileView');
        const profileEditForm = document.getElementById('profileEditForm');
        
        if (profileView) profileView.classList.remove('hidden');
        if (profileEditForm) profileEditForm.classList.add('hidden');
    }

    private switchToEditMode(): void {
        const profileView = document.getElementById('profileView');
        const profileEditForm = document.getElementById('profileEditForm');
        
        if (profileView) profileView.classList.add('hidden');
        if (profileEditForm) profileEditForm.classList.remove('hidden');
        
        const nameInput = document.getElementById('profileName') as HTMLInputElement;
        if (nameInput) {
            setTimeout(() => nameInput.focus(), 100);
        }
    }

    showGroupProfileModal(profile: GroupProfile): void {
        const modal = document.getElementById('groupProfileModal');
        if (!modal) {
            console.error('❌ groupProfileModal not found');
            return;
        }
    
        this.resetModalState('groupProfileModal');
    
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
                    
                    let adminTitle = '';
                    if (member.title) {
                        if (typeof member.title === 'string') {
                            adminTitle = member.title;
                        } else if (member.title.Valid !== undefined && member.title.String !== undefined) {
                            adminTitle = member.title.Valid ? member.title.String : '';
                        } else if (member.title.valid !== undefined && member.title.string !== undefined) {
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
                this.groupManager.leaveGroup();
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
        this.setupProfileModalCloseHandlers();
        this.setupProfileEditHandlers();
        
        const sidebarHeader = document.querySelector('.sidebar-header');
        
        if (sidebarHeader) {
            sidebarHeader.removeEventListener('click', this.handleSidebarUserClick);
            sidebarHeader.addEventListener('click', this.handleSidebarUserClick.bind(this));
            
            const userInfoElement = sidebarHeader.querySelector('.user-info') as HTMLElement;
            if (userInfoElement) {
                userInfoElement.style.cursor = 'pointer';
                userInfoElement.style.transition = 'opacity 0.2s';
                
                userInfoElement.addEventListener('mouseenter', () => {
                    userInfoElement.style.opacity = '0.8';
                });
                userInfoElement.addEventListener('mouseleave', () => {
                    userInfoElement.style.opacity = '1';
                });
            }
        } else {
            setTimeout(() => this.setupSidebarUserClickHandler(), 500);
        }
    }

    private handleSidebarUserClick(e: Event): void {
        const target = e.target as HTMLElement;
        const userInfoElement = target.closest('.user-info');
        
        if (userInfoElement) {
            e.preventDefault();
            e.stopPropagation();
            this.openMyProfile();
        }
    }
    
    private setupSidebarUserClickHandler(attempts: number = 3): void {
        if (attempts <= 0) {
            console.error('❌ Failed to setup sidebar click handler after multiple attempts');
            return;
        }
        
        const userInfoElement = document.querySelector('.user-info') as HTMLElement;
        
        if (userInfoElement) {
            userInfoElement.style.cursor = 'pointer';
            userInfoElement.removeEventListener('click', this.handleUserInfoClick);
            userInfoElement.addEventListener('click', this.handleUserInfoClick.bind(this));
        } else {
            setTimeout(() => this.setupSidebarUserClickHandler(attempts - 1), 1000);
        }
    }
    
    private handleUserInfoClick(e: Event): void {
        e.preventDefault();
        e.stopPropagation();
        this.openMyProfile();
    }

    private setupProfileEditHandlers(): void {
        const editBtn = document.getElementById('editProfileBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                this.switchToEditMode();
            });
        }
    
        const saveBtn = document.getElementById('saveProfileBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.saveProfile();
            });
        }
    
        const cancelEditBtn = document.getElementById('cancelEditProfileBtn');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => {
                this.switchToViewMode();
            });
        }
    }

    private async saveProfile(): Promise<void> {
        if (!this.currentUser) {
            this.showError('Пользователь не найден');
            return;
        }
    
        const nameInput = document.getElementById('profileName') as HTMLInputElement;
        const usernameInput = document.getElementById('profileUsername') as HTMLInputElement;
        const bioTextarea = document.getElementById('profileBio') as HTMLTextAreaElement;
    
        const newName = nameInput?.value.trim() || '';
        const newUsername = usernameInput?.value.trim() || '';
        const newBio = bioTextarea?.value.trim() || '';
    
        if (!newName) {
            this.showError('Имя не может быть пустым');
            return;
        }
    
        let cleanUsername = newUsername;
        if (cleanUsername.startsWith('@')) {
            cleanUsername = cleanUsername.substring(1);
        }
    
        if (!cleanUsername) {
            this.showError('Юзернейм не может быть пустым');
            return;
        }
    
        try {
            const savePromises = [];
    
            if (newName !== this.currentUser.name) {
                savePromises.push(this.api.updateName(this.currentUser.id, newName));
            }
    
            if (cleanUsername !== this.currentUser.username) {
                savePromises.push(this.api.updateUsername(this.currentUser.id, cleanUsername));
            }
    
            if (newBio !== this.currentUser.bio) {
                savePromises.push(this.api.updateBio(this.currentUser.id, newBio));
            }
    
            if (savePromises.length > 0) {
                const saveBtn = document.getElementById('saveProfileBtn') as HTMLButtonElement;
                if (saveBtn) {
                    saveBtn.disabled = true;
                    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
                }
    
                await Promise.all(savePromises);
    
                this.currentUser.name = newName;
                this.currentUser.username = cleanUsername;
                this.currentUser.bio = newBio;
    
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить';
                }
            }
    
            const displayName = document.getElementById('profileDisplayName') as HTMLElement;
            const displayUsername = document.getElementById('profileDisplayUsername') as HTMLElement;
            const displayBio = document.getElementById('profileDisplayBio') as HTMLElement;
            
            if (displayName) displayName.textContent = newName;
            if (displayUsername) displayUsername.textContent = `@${cleanUsername}`;
            if (displayBio) displayBio.textContent = newBio || 'Нет описания';
    
            this.switchToViewMode();
            this.updateSidebarUserInfo();
            this.showSuccess('Профиль успешно обновлен');
    
        } catch (error) {
            console.error('❌ Failed to save profile:', error);
            
            const saveBtn = document.getElementById('saveProfileBtn') as HTMLButtonElement;
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить';
            }
            
            this.showError('Не удалось сохранить профиль');
        }
    }

    private updateSidebarUserInfo(): void {
        if (!this.currentUser) return;
    
        const userNameElement = document.getElementById('userName');
        const userAvatarElement = document.getElementById('userAvatar') as HTMLImageElement;
    
        if (userNameElement) {
            userNameElement.textContent = this.currentUser.name;
        }
    
        if (userAvatarElement) {
            userAvatarElement.src = this.currentUser.avatar_url || 'https://via.placeholder.com/40';
        }
    }

    private showSuccess(message: string): void {
        alert(message);
    }

    private setupProfileModalCloseHandlers(): void {
        const modal = document.getElementById('profileModal');
        if (!modal) return;
    
        const closeBtn = document.getElementById('closeProfileModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeModal('profileModal');
            });
        }
    
        const cancelBtn = document.getElementById('cancelProfileBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeModal('profileModal');
            });
        }
    
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal('profileModal');
            }
        });
    
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                this.closeModal('profileModal');
            }
        });
    }

    setupGroupProfileModalHandlers(): void {
        const modal = document.getElementById('groupProfileModal');
        if (!modal) return;
    
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeModal('groupProfileModal');
            });
        }
    
        const cancelBtn = document.getElementById('cancelGroupProfileBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeModal('groupProfileModal');
            });
        }
    
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal('groupProfileModal');
            }
        });
    
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
            // 🔴 Закрываем вебсокет при закрытии любой профильной модалки
            if (modalId === 'profileModal' || modalId === 'userProfileModal' || modalId === 'groupProfileModal') {
                this.disconnectProfileWS();
            }
            
            if (modalId === 'profileModal') {
                this.switchToViewMode();
            }
            
            modal.classList.add('hidden');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    }

    // 🔴 УЛУЧШЕННЫЙ МЕТОД ДЛЯ ЗАКРЫТИЯ WebSocket
    private disconnectProfileWS(): void {
        console.log('🔴 Disconnecting profile WebSocket');
        this.shouldReconnect = false;
        
        // Удаляем слушатель
        if (this.currentProfileWSListener) {
            profileWebSocket.removeMessageListener(this.currentProfileWSListener);
            this.currentProfileWSListener = null;
        }
        
        // Закрываем WebSocket
        if (this.profileWS) {
            if (typeof this.profileWS.disconnect === 'function') {
                this.profileWS.disconnect();
            } else if (this.profileWS.close && typeof this.profileWS.close === 'function') {
                this.profileWS.close();
            }
            this.profileWS = null;
        }
        
        // Также отключаемся от profileWebSocket
        profileWebSocket.disconnect();
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