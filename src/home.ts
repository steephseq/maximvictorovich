import { ProfileAPI } from './api.js';
import { Chat, User } from './types.js';
import { authManager } from './auth.js';
import { SearchManager } from './search.js';
import { GroupManager } from './groupManager.js';
import { VideoPlayer } from './videoPlayer.js';
import { FileUploader } from './fileUploader.js';
import { ProfileManager } from './profileManager.js';
import { MessageManager } from './messageManager.js';
import { ImageViewer } from './imageViewer.js';

class HomeManager {
    private api!: ProfileAPI;
    private currentUser: User | null = null;
    private currentChat: Chat | null = null;
    private chats: Chat[] = [];
    private chatOffset: number = 0;
    private searchManager!: SearchManager;
    private fileInput: HTMLInputElement | null = null;
    private imageViewer!: ImageViewer;
    // Менеджеры
    private videoPlayer!: VideoPlayer;
    private groupManager!: GroupManager;
    private fileUploader!: FileUploader;
    private profileManager!: ProfileManager;
    private messageManager!: MessageManager;

    constructor() {
        if (!this.checkAuth()) {
            return;
        }
        
        this.api = new ProfileAPI();
        this.initManagers();
        this.init();
        
        // Делаем HomeManager доступным глобально для MessageManager
        (window as any).homeManager = this;
    }

    private checkAuth(): boolean {
        if (!authManager.isTokenValid()) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }

    private initManagers(): void {
        this.videoPlayer = new VideoPlayer();
        this.groupManager = new GroupManager(this.api, this);
        // В конструкторе HomeManager:
this.fileUploader = new FileUploader(
    this.api,
    (url: string, file: File) => this.onFileUploadComplete(url, file),
    (error: string) => this.showError(error),
    () => this.currentChat?.id || null,
    () => this.currentUser // 🔴 ДОБАВИТЬ ЭТУ СТРОЧКУ
);
        this.profileManager = new ProfileManager(this.api, this.groupManager);
        this.messageManager = new MessageManager(this.api, this.videoPlayer);
        this.imageViewer = new ImageViewer();
    }

    private async init(): Promise<void> {
        try {
            await this.loadUserData();
            
            this.groupManager.setCurrentUser(this.currentUser!);
            this.profileManager.setCurrentUser(this.currentUser!);
            this.messageManager.setCurrentUser(this.currentUser!);
            
            await this.loadChats();
            
            this.searchManager = new SearchManager(this.api, this);
            
            this.setupEventListeners();
            this.setupProfileClickHandlers();
            this.profileManager.setupProfileModalHandlers();
            this.profileManager.setupGroupProfileModalHandlers();
            this.profileManager.setupChatHeaderClickHandlers();
            
            this.renderChats();
            this.messageManager.setupMessageActions();
            
        } catch (error) {
            console.error('HomeManager initialization failed:', error);
            this.handleAuthError(error);
        }
    }
    
    private handleAuthError(error: any): void {
        if (error.message?.includes('401') || error.message?.includes('JWT') || error.message?.includes('token')) {
            authManager.logout();
            window.location.href = 'index.html';
        }
    }

    

    private async loadUserData(): Promise<void> {
        try {
            this.currentUser = await this.api.getProfile();
            this.updateUserUI();
            
        } catch (error) {
            console.error('Failed to load user:', error);
            throw error;
        }
    }
    
    private updateUserUI(): void {
        if (!this.currentUser) return;
    
        const userNameElement = document.getElementById('userName');
        const userAvatarElement = document.getElementById('userAvatar') as HTMLImageElement;
        const userUsernameElement = document.querySelector('.user-username');
    
        if (userNameElement) {
            userNameElement.textContent = this.currentUser.name;
            userNameElement.style.cursor = 'pointer';
        }
    
        if (userAvatarElement) {
            const avatarUrl = this.currentUser.avatar_url || this.currentUser.avatar || this.currentUser.url;
            if (avatarUrl) {
                userAvatarElement.src = avatarUrl;
            }
            userAvatarElement.style.cursor = 'pointer';
        }
    
        if (userUsernameElement) {
            userUsernameElement.textContent = `@${this.currentUser.username}`;
        }
    }

    private setupProfileClickHandlers(): void {
        const userNameElement = document.getElementById('userName');
        const userAvatarElement = document.getElementById('userAvatar');

        if (userNameElement) {
            userNameElement.addEventListener('click', () => {
                this.profileManager.openMyProfile();
            });
        }

        if (userAvatarElement) {
            userAvatarElement.addEventListener('click', () => {
                this.profileManager.openMyProfile();
            });
        }
    }

    private async onFileUploadComplete(url: string, file: File): Promise<void> {
        if (this.currentChat) {
            const fileType = this.api.getFileType(file);
            
            if (fileType === 'video') {
                const shortDescription = this.fileUploader.getFileShortDescription(fileType, file.name);
                this.updateChatPosition(this.currentChat!.id, shortDescription);
            }
            
            // Автоматически перезагружаем сообщения чтобы показать новое
            try {
                const messages = await this.api.getMessages(this.currentChat.id);
                await this.messageManager.renderMessages(messages);
                this.scrollToBottom();
            } catch (error) {
                console.error('Failed to reload messages:', error);
            }
        }
    }

    private sendMessageWithFile(fileUrl: string, file: File): void {
        // Для не-видео файлов можно добавить отправку через WebSocket
        // если потребуется
    }

    public updateChatPositionOnNewMessage(chatId: number, lastMessage: string): void {
        const chatIndex = this.chats.findIndex(chat => chat.id === chatId);
        
        if (chatIndex > -1) {
            const chatToUpdate = this.chats[chatIndex];
            const formattedLastMessage = this.formatLastMessageForChatList(lastMessage);
            
            // Обновляем последнее сообщение
            chatToUpdate.last_message = formattedLastMessage;
            chatToUpdate.lastMessage = formattedLastMessage;
            
            // Перемещаем чат в начало списка только если он не уже первый
            if (chatIndex > 0) {
                this.chats.splice(chatIndex, 1);
                this.chats.unshift(chatToUpdate);
                this.renderChats();
            } else {
                // Если чат уже первый, просто обновляем текст последнего сообщения
                this.updateChatElement(chatId, formattedLastMessage);
            }
            
            // Обновляем currentChat если он активен
            if (this.currentChat && this.currentChat.id === chatId) {
                this.currentChat.last_message = formattedLastMessage;
                this.currentChat.lastMessage = formattedLastMessage;
            }
        }
    }

    private async loadChats(): Promise<void> {
        try {
            const newChats = await this.api.getChats(this.chatOffset);
            
            if (newChats.length > 0) {
                const normalizedChats = this.normalizeApiResponse<Chat[]>(newChats);
                this.chats.push(...normalizedChats);
                this.chatOffset += newChats.length;
            }
        } catch (error) {
            console.error('Failed to load chats:', error);
            throw error;
        }
    }

    private setupEventListeners(): void {
        const backButton = document.getElementById('backToChats');
        if (backButton) {
            backButton.addEventListener('click', () => {
                this.showWelcomeScreen();
            });
        }

        const searchInput = document.getElementById('searchChats') as HTMLInputElement;
        if (searchInput) {
            searchInput.addEventListener('input', (e: Event) => {
                this.filterChats((e.target as HTMLInputElement).value);
            });

            searchInput.addEventListener('focus', () => {
                this.searchManager.openSearch();
                const globalSearchInput = document.getElementById('globalSearchInput') as HTMLInputElement;
                if (globalSearchInput && searchInput.value) {
                    globalSearchInput.value = searchInput.value;
                    globalSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
        }

        this.setupFileUpload();

        const chatsList = document.getElementById('chatsList');
        if (chatsList) {
            chatsList.addEventListener('scroll', () => {
                if (chatsList.scrollTop + chatsList.clientHeight >= chatsList.scrollHeight - 5) {
                    this.loadChats().then(() => this.renderChats());
                }
            });
        }
    }

    private setupFileUpload(): void {
        const attachmentBtn = document.querySelector('.attachment-btn');
        if (attachmentBtn) {
            attachmentBtn.addEventListener('click', () => {
                this.openFilePicker();
            });
        }

        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            this.fileUploader.setupDropZone(messagesContainer);
        }
    }

    private openFilePicker(): void {
        if (!this.fileInput) {
            this.fileInput = this.fileUploader.createFileInput();
        }
        this.fileInput.click();
    }

    public addNewChat(chat: Chat): void {
        const existingChatIndex = this.chats.findIndex(c => c.id === chat.id);
        
        if (existingChatIndex === -1) {
            this.chats.unshift(chat);
            this.renderChats();
        } else {
            this.chats[existingChatIndex] = chat;
            this.renderChats();
        }
    }

    public async selectChat(chat: Chat): Promise<void> {
            
        this.setCurrentChat(chat);
        
        this.messageManager.setCurrentChat(chat);
        this.profileManager.setCurrentChat(chat);
        
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const clickedElement = document.querySelector(`.chat-item[data-chat-id="${chat.id}"]`);
        if (clickedElement) {
            clickedElement.classList.add('active');
        }

        this.showChatWindow();

        try {
            const numericChatId = Number(chat.id);
            
            if (isNaN(numericChatId)) {
                throw new Error(`Invalid chat ID: ${chat.id}`);
            }

            const messages = await this.api.getMessages(numericChatId);
            this.messageManager.renderMessages(messages);
            await this.messageManager.connectWebSocket(numericChatId);
            this.messageManager.setupMessageSending();
            
        } catch (error) {
            console.error('Failed to load chat:', error);
            this.showError('Не удалось загрузить чат');
        }
    }

    private renderChats(): void {
        const chatsList = document.getElementById('chatsList');
        if (!chatsList) {
            console.error('chatsList element not found!');
            return;
        }

        if (this.chats.length === 0) {
            chatsList.innerHTML = `
                <div class="empty-chats">
                    <i class="fas fa-comments"></i>
                    <p>Нет чатов</p>
                    <span>Создайте новый чат чтобы начать общение!</span>
                </div>
            `;
            return;
        }

        chatsList.innerHTML = '';

        this.chats.forEach(chat => {
            const existingElement = chatsList.querySelector(`[data-chat-id="${chat.id}"]`);
            if (!existingElement) {
                const chatElement = this.createChatElement(chat);
                chatsList.appendChild(chatElement);
            }
        });
    }

    private createChatElement(chat: Chat): HTMLElement {
        const chatDiv = document.createElement('div');
        chatDiv.className = 'chat-item';
        chatDiv.setAttribute('data-chat-id', chat.id.toString());
        
        const avatar = chat.avatar_url || chat.avatar || chat.url || 'https://via.placeholder.com/50';
        const lastMessage = chat.last_message || chat.lastMessage || 'Нет сообщений';
        const unreadCount = chat.unread_count || chat.unreadCount || 0;
        const isOnline = chat.online || false;
        const chatName = chat.name || 'Без имени';

        const avatarHTML = avatar 
            ? `<img src="${avatar}" alt="${chatName}" onerror="this.src='https://via.placeholder.com/50'">`
            : `<i class="fas fa-user"></i>`;

        chatDiv.innerHTML = `
            <div class="chat-avatar">
                ${avatarHTML}
                ${isOnline ? '<span class="online-dot"></span>' : ''}
            </div>
            <div class="chat-info">
                <div class="chat-name">${this.escapeHtml(chatName)}</div>
                <div class="chat-last-message">${this.escapeHtml(lastMessage)}</div>
            </div>
            <div class="chat-meta">
                ${unreadCount > 0 ? `<div class="chat-badge">${unreadCount}</div>` : ''}
            </div>
        `;

        chatDiv.addEventListener('click', () => {
            this.selectChat(chat);
        });

        return chatDiv;
    }

    public setCurrentChat(chat: Chat): void {
        this.currentChat = chat;
        
        if (this.groupManager) {
            this.groupManager.setCurrentChatId(chat.id);
        }
        
        this.updateChatHeader();
    }

    private updateChatHeader(): void {
        if (!this.currentChat) return;
    
        const chatName = document.getElementById('currentChatName');
        const chatAvatar = document.getElementById('currentChatAvatar') as HTMLImageElement;
        const chatStatus = document.getElementById('currentChatStatus');
    
        const avatar = this.currentChat.avatar_url || this.currentChat.avatar || this.currentChat.url;
        const chatNameText = this.currentChat.name || 'Без имени';
    
        if (chatName) {
            chatName.textContent = chatNameText;
        }
    
        if (chatAvatar) {
            const avatarUrl = avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face';
            chatAvatar.src = avatarUrl;
            
            chatAvatar.onerror = () => {
                chatAvatar.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face';
            };
        }
    
        if (chatStatus) {
            if (this.currentChat.is_group) {
                const memberCount = (this.currentChat as any).count_members || 0;
                chatStatus.textContent = `${memberCount} участников`; 
            } else {
                const isOnline = this.currentChat.online || false;
                chatStatus.textContent = isOnline ? 'online' : 'offline';
                chatStatus.className = `chat-header-status online-status ${isOnline ? 'online' : ''}`;
            }
        }
    }

    private showChatWindow(): void {
        const welcomeSection = document.getElementById('welcomeSection');
        const chatSection = document.getElementById('chatSection');

        if (welcomeSection && chatSection) {
            welcomeSection.classList.add('hidden');
            chatSection.classList.remove('hidden');
        } else {
            console.error('Required sections not found!');
            return;
        }

        this.updateChatHeader();
    }

    private showWelcomeScreen(): void {
        const welcomeSection = document.getElementById('welcomeSection');
        const chatSection = document.getElementById('chatSection');

        if (welcomeSection && chatSection) {
            chatSection.classList.add('hidden');
            welcomeSection.classList.remove('hidden');
        }
        this.currentChat = null;
    }

    private scrollToBottom(): void {
        const container = document.getElementById('messagesContainer');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    private filterChats(query: string): void {
        const chats = document.querySelectorAll('.chat-item');
        const searchTerm = query.toLowerCase();

        chats.forEach(chat => {
            const name = chat.querySelector('.chat-name')?.textContent?.toLowerCase() || '';
            (chat as HTMLElement).style.display = name.includes(searchTerm) ? 'flex' : 'none';
        });
    }

    private updateChatPosition(chatId: number, lastMessage: string): void {
        const chatIndex = this.chats.findIndex(chat => chat.id === chatId);
        
        if (chatIndex > -1) {
            const chatToUpdate = this.chats[chatIndex];
            const formattedLastMessage = this.formatLastMessageForChatList(lastMessage);
            
            chatToUpdate.last_message = formattedLastMessage;
            chatToUpdate.lastMessage = formattedLastMessage;
            
            if (chatIndex > 0) {
                this.chats.splice(chatIndex, 1);
                this.chats.unshift(chatToUpdate);
                this.renderChats();
            } else {
                this.updateChatElement(chatId, formattedLastMessage);
            }
            
            if (this.currentChat && this.currentChat.id === chatId) {
                this.currentChat.last_message = formattedLastMessage;
                this.currentChat.lastMessage = formattedLastMessage;
            }
        }
    }

    private formatLastMessageForChatList(message: string): string {
        if (!message) return 'Нет сообщений';
        
        if (this.containsImage(message)) {
            return '📷 Фото';
        }
        
        if (this.containsVideo(message)) {
            return '🎥 Видео';
        }
        
        if (this.containsAudio(message)) {
            return '🎵 Аудио';
        }
        
        if (this.containsDocument(message)) {
            return '📄 Документ';
        }
        
        if (this.containsFile(message)) {
            return '📎 Файл';
        }
        
        return this.truncateMessage(message, 50);
    }

    private containsImage(message: string): boolean {
        const imageRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|bmp)(\?[^\s]*)?)/gi;
        return imageRegex.test(message) || message.includes('📷');
    }

    private containsVideo(message: string): boolean {
        const videoRegex = /(https?:\/\/[^\s]+\.(mp4|mov|avi|mkv|webm)(\?[^\s]*)?)/gi;
        return videoRegex.test(message) || message.includes('🎥');
    }

    private containsAudio(message: string): boolean {
        const audioRegex = /(https?:\/\/[^\s]+\.(mp3|wav|ogg|flac)(\?[^\s]*)?)/gi;
        return audioRegex.test(message) || message.includes('🎵');
    }

    private containsDocument(message: string): boolean {
        const docRegex = /(https?:\/\/[^\s]+\.(pdf|doc|docx|txt)(\?[^\s]*)?)/gi;
        return docRegex.test(message) || message.includes('📄') || message.includes('📝');
    }

    private containsFile(message: string): boolean {
        return message.includes('📎') && message.includes('https://');
    }

    private truncateMessage(message: string, maxLength: number): string {
        if (message.length <= maxLength) return message;
        return message.substring(0, maxLength) + '...';
    }

    private updateChatElement(chatId: number, lastMessage: string): void {
        const chatElement = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
        if (!chatElement) return;

        const lastMessageElement = chatElement.querySelector('.chat-last-message');
        if (lastMessageElement) {
            lastMessageElement.textContent = this.escapeHtml(lastMessage);
        }
    }

    private normalizeApiResponse<T>(response: any): T {
        if (Array.isArray(response)) {
            return response as T;
        }
        
        if (response && typeof response === 'object') {
            const apiResponse = response as any;
            
            if (apiResponse.Data && Array.isArray(apiResponse.Data)) {
                return apiResponse.Data as T;
            }
            if (apiResponse.data && Array.isArray(apiResponse.data)) {
                return apiResponse.data as T;
            }
            if (apiResponse.messages && Array.isArray(apiResponse.messages)) {
                return apiResponse.messages as T;
            }
            if (apiResponse.result && Array.isArray(apiResponse.result)) {
                return apiResponse.result as T;
            }
            if (apiResponse.chats && Array.isArray(apiResponse.chats)) {
                return apiResponse.chats as T;
            }
        }
        
        return [] as unknown as T;
    }

    

    private escapeHtml(unsafe: any): string {
        if (!unsafe) return '';
        
        const safeString = String(unsafe);
        
        return safeString
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    private showError(message: string): void {
        console.error('Error:', message);
        alert(message);
    }

    getChats(): Chat[] {
        return this.chats;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new HomeManager();
});