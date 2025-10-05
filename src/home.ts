import { ProfileAPI } from './api.js';
import { Chat, Message, User } from './types.js';
import { authManager } from './auth.js';
import { SearchManager } from './search.js';
import { GroupManager } from './groupManager.js';

class VideoPlayer {
    private modal!: HTMLDivElement;
    private video!: HTMLVideoElement;
    private playBtn!: HTMLButtonElement;
    private muteBtn!: HTMLButtonElement;
    private fullscreenBtn!: HTMLButtonElement;
    private progressBar!: HTMLDivElement;
    private progressContainer!: HTMLDivElement;
    private timeDisplay!: HTMLDivElement;
    private closeBtn!: HTMLButtonElement;
    private isPlaying: boolean = false;
    private isMuted: boolean = false;
    private isFullscreen: boolean = false;

    constructor() {
        this.createModal();
        this.setupEventListeners();
    }

    private createModal(): void {
        this.modal = document.createElement('div');
        this.modal.className = 'video-modal';
        this.modal.innerHTML = `
            <div class="video-modal-content">
                <button class="close-btn">
                    <i class="fas fa-times"></i>
                </button>
                <video class="video-player" preload="metadata">
                    Ваш браузер не поддерживает видео.
                </video>
                <div class="video-controls">
                    <button class="control-btn play-btn" title="Воспроизвести/Пауза">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="control-btn mute-btn" title="Отключить звук">
                        <i class="fas fa-volume-up"></i>
                    </button>
                    <div class="progress-container">
                        <div class="progress-bar"></div>
                    </div>
                    <div class="time-display">0:00 / 0:00</div>
                    <button class="control-btn fullscreen" title="Полный экран">
                        <i class="fas fa-expand"></i>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);

        this.video = this.modal.querySelector('.video-player') as HTMLVideoElement;
        this.playBtn = this.modal.querySelector('.play-btn') as HTMLButtonElement;
        this.muteBtn = this.modal.querySelector('.mute-btn') as HTMLButtonElement;
        this.fullscreenBtn = this.modal.querySelector('.fullscreen') as HTMLButtonElement;
        this.progressBar = this.modal.querySelector('.progress-bar') as HTMLDivElement;
        this.progressContainer = this.modal.querySelector('.progress-container') as HTMLDivElement;
        this.timeDisplay = this.modal.querySelector('.time-display') as HTMLDivElement;
        this.closeBtn = this.modal.querySelector('.close-btn') as HTMLButtonElement;
    }

    private setupEventListeners(): void {
        this.playBtn.addEventListener('click', () => this.togglePlay());
        this.video.addEventListener('click', () => this.togglePlay());
        
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        
        this.progressContainer.addEventListener('click', (e) => this.setProgress(e));
        
        this.video.addEventListener('timeupdate', () => this.updateProgress());
        this.video.addEventListener('loadedmetadata', () => this.updateTimeDisplay());
        
        this.closeBtn.addEventListener('click', () => this.close());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });
        
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        this.video.addEventListener('play', () => this.updatePlayState(true));
        this.video.addEventListener('pause', () => this.updatePlayState(false));
        this.video.addEventListener('ended', () => this.updatePlayState(false));
        
        document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
    }

    public open(videoUrl: string, thumbnailUrl?: string): void {
        this.video.src = videoUrl;
        this.video.poster = thumbnailUrl || '';
        
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        this.video.play().catch(() => {
            console.log('Автовоспроизведение заблокировано');
        });
    }

    public close(): void {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        this.video.pause();
        this.video.currentTime = 0;
        this.updatePlayState(false);
        
        setTimeout(() => {
            this.video.src = '';
        }, 300);
    }

    private togglePlay(): void {
        if (this.video.paused) {
            this.video.play();
        } else {
            this.video.pause();
        }
    }

    private toggleMute(): void {
        this.isMuted = !this.isMuted;
        this.video.muted = this.isMuted;
        
        const icon = this.muteBtn.querySelector('i') as HTMLElement;
        if (this.isMuted) {
            icon.className = 'fas fa-volume-mute';
            this.muteBtn.classList.add('muted');
        } else {
            icon.className = 'fas fa-volume-up';
            this.muteBtn.classList.remove('muted');
        }
    }

    private toggleFullscreen(): void {
        if (!document.fullscreenElement) {
            this.modal.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    }

    private handleFullscreenChange(): void {
        this.isFullscreen = !!document.fullscreenElement;
        
        const icon = this.fullscreenBtn.querySelector('i') as HTMLElement;
        if (this.isFullscreen) {
            icon.className = 'fas fa-compress';
        } else {
            icon.className = 'fas fa-expand';
        }
    }

    private setProgress(e: MouseEvent): void {
        const rect = this.progressContainer.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        this.video.currentTime = percent * this.video.duration;
    }

    private updateProgress(): void {
        const percent = (this.video.currentTime / this.video.duration) * 100;
        this.progressBar.style.width = `${percent}%`;
        this.updateTimeDisplay();
    }

    private updateTimeDisplay(): void {
        const currentTime = this.formatTime(this.video.currentTime);
        const duration = this.formatTime(this.video.duration);
        this.timeDisplay.textContent = `${currentTime} / ${duration}`;
    }

    private formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    private updatePlayState(playing: boolean): void {
        this.isPlaying = playing;
        const icon = this.playBtn.querySelector('i') as HTMLElement;
        icon.className = playing ? 'fas fa-pause' : 'fas fa-play';
    }

    private handleKeyPress(e: KeyboardEvent): void {
        if (!this.modal.classList.contains('active')) return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                this.togglePlay();
                break;
            case 'Escape':
                if (this.isFullscreen) {
                    this.toggleFullscreen();
                } else {
                    this.close();
                }
                break;
            case 'KeyM':
                this.toggleMute();
                break;
            case 'ArrowLeft':
                this.video.currentTime = Math.max(0, this.video.currentTime - 5);
                break;
            case 'ArrowRight':
                this.video.currentTime = Math.min(this.video.duration, this.video.currentTime + 5);
                break;
            case 'KeyF':
                this.toggleFullscreen();
                break;
        }
    }
}

class WebSocketManager {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectInterval = 3000;
    private messageHandlers: ((message: Message) => void)[] = [];
    private chatUpdateHandlers: ((chatId: number, lastMessage: string) => void)[] = [];

    constructor(private chatId: number) {}

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    throw new Error('No token found');
                }

                const wsUrl = `wss://localhost:8080/ws?id=${this.chatId}&token=${encodeURIComponent(token)}`;
                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    this.reconnectAttempts = 0;
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message: Message = JSON.parse(event.data);
                        this.notifyMessageHandlers(message);
                        this.notifyChatUpdateHandlers(message.chat_id, message.content || '');
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                    }
                };

                this.ws.onclose = () => {
                    this.handleReconnection();
                };

                this.ws.onerror = (error) => {
                    reject(error);
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    private handleReconnection(): void {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
                this.connect().catch(() => {});
            }, this.reconnectInterval);
        }
    }

    sendMessage(content: string, type?: string): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message: any = {
                content: content,
                chat_id: this.chatId
            };
            if (type) {
                message.type = type;
            }
            this.ws.send(JSON.stringify(message));
        } else {
            throw new Error('WebSocket is not connected');
        }
    }

    addMessageHandler(handler: (message: Message) => void): void {
        this.messageHandlers.push(handler);
    }

    removeMessageHandler(handler: (message: Message) => void): void {
        const index = this.messageHandlers.indexOf(handler);
        if (index > -1) {
            this.messageHandlers.splice(index, 1);
        }
    }

    addChatUpdateHandler(handler: (chatId: number, lastMessage: string) => void): void {
        this.chatUpdateHandlers.push(handler);
    }

    removeChatUpdateHandler(handler: (chatId: number, lastMessage: string) => void): void {
        const index = this.chatUpdateHandlers.indexOf(handler);
        if (index > -1) {
            this.chatUpdateHandlers.splice(index, 1);
        }
    }

    private notifyMessageHandlers(message: Message): void {
        this.messageHandlers.forEach(handler => {
            try {
                handler(message);
            } catch (error) {
                console.error('Error in message handler:', error);
            }
        });
    }

    private notifyChatUpdateHandlers(chatId: number, lastMessage: string): void {
        this.chatUpdateHandlers.forEach(handler => {
            try {
                handler(chatId, lastMessage);
            } catch (error) {
                console.error('Error in chat update handler:', error);
            }
        });
    }

    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.messageHandlers = [];
        this.chatUpdateHandlers = [];
    }

    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
}

interface ApiResponse<T> {
    data?: T;
    messages?: T;
    result?: T;
    [key: string]: any;
}

class FileUploader {
    private api: ProfileAPI;
    private onUploadComplete: (url: string, file: File) => void;
    private onUploadError: (error: string) => void;
    private getChatId: () => number | null;

    constructor(
        api: ProfileAPI,
        onUploadComplete: (url: string, file: File) => void,
        onUploadError: (error: string) => void,
        getChatId: () => number | null
    ) {
        this.api = api;
        this.onUploadComplete = onUploadComplete;
        this.onUploadError = onUploadError;
        this.getChatId = getChatId;
    }

    async uploadFile(file: File, progressCallback?: (messageId: number, progress: number) => void): Promise<void> {
        try {
            if (!this.api.validateFileSize(file, 1024)) {
                throw new Error(`Файл слишком большой. Максимальный размер: 1024MB`);
            }
            
            const fileType = this.api.getFileType(file);
            const chatId = this.getChatId();
            
            if (!chatId) {
                throw new Error('Чат не выбран');
            }
            
            if (fileType === 'video') {
                console.log('🎥 Загрузка видео: создаем пустое сообщение...');
                const messageId = await this.api.createEmptyMessage(chatId, 'video');
                console.log('✅ Пустое сообщение создано с ID:', messageId);
                
                // Создаем thumbnail локально
                const thumbnail = await this.createVideoThumbnail(file);
                
                // Показываем сообщение с индикатором загрузки
                if (progressCallback) {
                    progressCallback(messageId, 0);
                }
                
                console.log('📤 Загружаем видео файл...');
                const fileUrl = await this.api.uploadFile(file, messageId);
                console.log('✅ Видео загружено:', fileUrl);
                
                if (progressCallback) {
                    progressCallback(messageId, 100);
                }
                
                this.onUploadComplete(fileUrl, file);
            } else {
                const fileUrl = await this.api.uploadFile(file);
                this.onUploadComplete(fileUrl, file);
            }

        } catch (error: any) {
            console.error('❌ Ошибка загрузки файла:', error);
            this.onUploadError(error.message || 'Не удалось загрузить файл');
        }
    }

    private async createVideoThumbnail(file: File): Promise<string> {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            video.preload = 'metadata';
            video.src = URL.createObjectURL(file);
            
            video.addEventListener('loadeddata', () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                video.currentTime = 1; // Берем кадр с 1 секунды
            });
            
            video.addEventListener('seeked', () => {
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
                    URL.revokeObjectURL(video.src);
                    resolve(thumbnail);
                }
            });
            
            video.addEventListener('error', () => {
                URL.revokeObjectURL(video.src);
                resolve('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjMzczODNkIi8+CjxwYXRoIGQ9Ik0xNjAgMTI1VjE3NUwyMDAgMTUwTDE2MCAxMjVaIiBmaWxsPSIjNjE2MTZiIi8+Cjwvc3ZnPg==');
            });
        });
    }

    createFileInput(accept: string = '*'): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.style.display = 'none';
        
        input.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            if (target.files && target.files[0]) {
                this.uploadFile(target.files[0]);
            }
            target.value = '';
        });

        document.body.appendChild(input);
        return input;
    }

    setupDropZone(dropZone: HTMLElement): void {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            
            if (e.dataTransfer && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                this.uploadFile(file);
            }
        });
    }
}

class HomeManager {
    private api!: ProfileAPI;
    private currentUser: User | null = null;
    private currentChat: Chat | null = null;
    private currentProfile: any = null;
    private chats: Chat[] = [];
    private wsManager: WebSocketManager | null = null;
    private tempMessageIds: Set<string> = new Set();
    private searchManager!: SearchManager;
    private groupManager!: GroupManager;
    private fileUploader!: FileUploader;
    private fileInput: HTMLInputElement | null = null;
    private videoPlayer!: VideoPlayer;

    constructor() {
        if (!this.checkAuth()) {
            return;
        }
        
        this.api = new ProfileAPI();
        this.videoPlayer = new VideoPlayer();
        this.init();
    }

    private checkAuth(): boolean {
        if (!authManager.isTokenValid()) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }

    private async init(): Promise<void> {
        try {
            await this.loadUserData();
            await this.loadChats();
            
            this.searchManager = new SearchManager(this.api, this);
            this.groupManager = new GroupManager(this.api, this);
            
            this.initFileUploader();
            this.setupEventListeners();
            this.renderChats();
        } catch (error) {
            this.handleAuthError(error);
        }
    }

    private handleAuthError(error: any): void {
        if (error.message?.includes('401') || error.message?.includes('JWT')) {
            authManager.logout();
            window.location.href = 'index.html';
        }
    }

    private initFileUploader(): void {
        this.fileUploader = new FileUploader(
            this.api,
            (url: string, file: File) => this.onFileUploadComplete(url, file),
            (error: string) => this.showError(error),
            () => this.currentChat?.id || null
        );
    }

    private onFileUploadComplete(url: string, file: File): void {
        if (this.currentChat) {
            this.sendMessageWithFile(url, file);
        }
    }

    private getFileShortDescription(fileType: string, fileName: string): string {
        switch (fileType) {
            case 'image': return '📷 Фото';
            case 'video': return '🎥 Видео';
            case 'audio': return '🎵 Аудио';
            case 'pdf': return '📄 Документ';
            case 'document': return '📄 Документ';
            default: return '📎 Файл';
        }
    }

    private sendMessageWithFile(fileUrl: string, file: File): void {
        const fileType = this.api.getFileType(file);
        let messageContent = '';
        
        switch (fileType) {
            case 'image':
                messageContent = fileUrl;
                break;
            case 'video':
                messageContent = `${fileUrl}`;
                break;
            case 'audio':
                messageContent = `${fileUrl}`;
                break;
            case 'pdf':
                messageContent = `${fileUrl}`;
                break;
            case 'document':
                messageContent = `${fileUrl}`;
                break;
            default:
                messageContent = `${fileUrl}`;
        }
        
        if (this.wsManager) {
            this.wsManager.sendMessage(messageContent, fileType);
            const shortDescription = this.getFileShortDescription(fileType, file.name);
            this.updateChatPosition(this.currentChat!.id, shortDescription);
        }
    }

    private async loadUserData(): Promise<void> {
        try {
            this.currentUser = await this.api.getProfile();
            this.updateUserUI();
        } catch (error) {
            console.error('Failed to load user:', error);
        }
    }

    private updateUserUI(): void {
        if (!this.currentUser) return;

        const userNameElement = document.getElementById('userName');
        const userAvatarElement = document.getElementById('userAvatar') as HTMLImageElement;

        if (userNameElement) {
            userNameElement.textContent = this.currentUser.name;
        }

        if (userAvatarElement) {
            const avatarUrl = this.currentUser.avatar_url || this.currentUser.avatar || this.currentUser.url;
            if (avatarUrl) {
                userAvatarElement.src = avatarUrl;
            }
        }
    }

    private async loadChats(): Promise<void> {
        try {
            const response = await this.api.getChats();
            this.chats = this.normalizeApiResponse<Chat[]>(response);
        } catch (error) {
            console.error('Failed to load chats:', error);
            this.chats = [];
        }
    }

    private normalizeApiResponse<T>(response: any): T {
        if (Array.isArray(response)) {
            return response as T;
        }
        
        if (response && typeof response === 'object') {
            const apiResponse = response as ApiResponse<T>;
            if (apiResponse.data && Array.isArray(apiResponse.data)) {
                return apiResponse.data as T;
            }
            if (apiResponse.messages && Array.isArray(apiResponse.messages)) {
                return apiResponse.messages as T;
            }
            if (apiResponse.result && Array.isArray(apiResponse.result)) {
                return apiResponse.result as T;
            }
        }
        
        return [] as unknown as T;
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
        this.currentChat = chat;
        
        if (this.wsManager) {
            this.wsManager.disconnect();
            this.wsManager = null;
        }

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
            this.renderMessages(messages);
            await this.connectWebSocket(numericChatId);
            this.setupMessageSending();
            
        } catch (error) {
            this.showError('Не удалось загрузить чат');
        }
    }

    private renderChats(): void {
        const chatsList = document.getElementById('chatsList');
        if (!chatsList) {
            console.error('chatsList element not found!');
            return;
        }
        chatsList.innerHTML = '';

        if (!this.chats || this.chats.length === 0) {
            chatsList.innerHTML = `
                <div class="empty-chats">
                    <i class="fas fa-comments"></i>
                    <p>Нет чатов</p>
                    <span>Создайте новый чат чтобы начать общение!</span>
                </div>
            `;
            return;
        }

        this.chats.forEach(chat => {
            const chatElement = this.createChatElement(chat);
            chatsList.appendChild(chatElement);
        });
    }

    private createChatElement(chat: Chat): HTMLElement {
        const chatDiv = document.createElement('div');
        chatDiv.className = 'chat-item';
        chatDiv.setAttribute('data-chat-id', chat.id.toString());
        
        const avatar = chat.avatar_url || chat.avatar || chat.url;
        const lastMessage = chat.last_message || chat.lastMessage || 'Нет сообщений';
        const unreadCount = chat.unread_count || chat.unreadCount || 0;
        const isOnline = chat.online || false;
        const chatName = chat.name || 'Без имени';

        const avatarHTML = avatar 
            ? `<img src="${avatar}" alt="${chatName}">`
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

    private async connectWebSocket(chatId: number): Promise<void> {
        this.wsManager = new WebSocketManager(chatId);
        
        this.wsManager.addMessageHandler((message: Message) => {
            this.handleNewMessage(message);
        });

        this.wsManager.addChatUpdateHandler((chatId: number, lastMessage: string) => {
            this.updateChatPosition(chatId, lastMessage);
        });

        try {
            await this.wsManager.connect();
        } catch (error) {
            this.showError('Не удалось подключиться к чату в реальном времени');
        }
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

    private setupMessageSending(): void {
        const messageInput = document.getElementById('messageInput') as HTMLTextAreaElement;
        const sendButton = document.getElementById('sendMessageBtn');

        if (!messageInput || !sendButton) {
            console.error('Message input elements not found');
            return;
        }

        sendButton.replaceWith(sendButton.cloneNode(true));
        const newSendButton = document.getElementById('sendMessageBtn')!;

        const sendMessage = () => {
            const content = messageInput.value.trim();
            if (content && this.wsManager && this.currentChat) {
                try {
                    const tempId = `temp_${Date.now()}`;
                    const tempMessage: Message = {
                        id: -1,
                        chat_id: this.currentChat.id,
                        user_id: this.currentUser!.id,
                        name: this.currentUser!.name,
                        content: content,
                        created_at: new Date().toISOString()
                    };
                    
                    this.appendTempMessage(tempMessage, true, tempId);
                    this.wsManager.sendMessage(content);
                    messageInput.value = '';
                    this.adjustTextareaHeight(messageInput);
                    
                    this.updateChatPosition(this.currentChat.id, content);
                    
                } catch (error) {
                    this.showError('Не удалось отправить сообщение');
                }
            }
        };

        newSendButton.addEventListener('click', sendMessage);

        messageInput.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        messageInput.addEventListener('input', () => {
            this.adjustTextareaHeight(messageInput);
        });

        messageInput.focus();
    }

    private adjustTextareaHeight(textarea: HTMLTextAreaElement): void {
        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, 80);
        textarea.style.height = newHeight + 'px';
        
        const inputBox = textarea.closest('.message-input-box') as HTMLElement;
        if (inputBox) {
            inputBox.style.height = (newHeight + 16) + 'px';
        }
    }

    private async handleNewMessage(message: Message): Promise<void> {
        const messagesContainer = document.getElementById('messagesList');
        if (!messagesContainer) return;

        if (message.id > 0 && messagesContainer.querySelector(`[data-message-id="${message.id}"]`)) {
            return;
        }

        const tempMessages = Array.from(messagesContainer.querySelectorAll('[data-temp-message="true"]'));
        let tempMessageFound = false;

        for (const tempMsg of tempMessages) {
            const messageContent = (tempMsg.querySelector('.message-content') as HTMLElement)?.textContent;
            const isOwnMessage = tempMsg.classList.contains('message-own');
            const tempId = tempMsg.getAttribute('data-temp-id');

            if (messageContent === message.content &&
                isOwnMessage === (message.user_id === this.currentUser?.id) &&
                tempId) {
                
                const realMessageElement = await this.createMessageElement(message, isOwnMessage);
                tempMsg.replaceWith(realMessageElement);
                tempMessageFound = true;
                this.tempMessageIds.delete(tempId);
                break;
            }
        }

        if (!tempMessageFound) {
            const isOwnMessage = message.user_id === this.currentUser?.id;
            await this.appendMessage(message, isOwnMessage);
        }

        this.scrollToBottom();
    }

    private async appendMessage(message: Message, isOwnMessage: boolean): Promise<void> {
        const messagesList = document.getElementById('messagesList');
        if (!messagesList) return;

        if (message.id > 0 && messagesList.querySelector(`[data-message-id="${message.id}"]`)) {
            return;
        }

        const emptyState = messagesList.querySelector('.empty-chat');
        if (emptyState) {
            emptyState.remove();
        }

        const messageElement = await this.createMessageElement(message, isOwnMessage);
        messagesList.appendChild(messageElement);
        this.scrollToBottom();
    }

    private async appendTempMessage(message: Message, isOwnMessage: boolean, tempId: string): Promise<void> {
        const messagesList = document.getElementById('messagesList');
        if (!messagesList) return;

        const emptyState = messagesList.querySelector('.empty-chat');
        if (emptyState) {
            emptyState.remove();
        }

        const messageElement = await this.createMessageElement(message, isOwnMessage);
        messageElement.setAttribute('data-temp-message', 'true');
        messageElement.setAttribute('data-temp-id', tempId);
        messageElement.classList.add('message-sending');

        messagesList.appendChild(messageElement);
        this.tempMessageIds.add(tempId);
        this.scrollToBottom();
    }

    private extractVideoUrl(content: string): string | null {
        if (!content) return null;
        
        const videoRegex = /(https?:\/\/[^\s]+\.(mp4|mov|avi|webm|mkv)(\?[^\s]*)?)/gi;
        const matches = content.match(videoRegex);
        
        if (matches && matches.length > 0) {
            return matches[0];
        }
        
        return null;
    }

    private async createMessageElement(message: Message, isOwnMessage: boolean): Promise<HTMLElement> {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwnMessage ? 'message-own' : 'message-other'}`;

    const time = new Date(message.created_at).toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Проверяем, есть ли видео
    const videoUrl = this.extractVideoUrl(message.content);
    if (videoUrl) {
        const thumbnailUrl = message.thumbnail_url || message.url || '';

        const videoContainer = document.createElement("div");
        videoContainer.className = "message-video relative cursor-pointer inline-block";
        videoContainer.dataset.videoUrl = videoUrl;
        videoContainer.dataset.messageId = message.id.toString();

        const thumbnail = document.createElement("img");
        thumbnail.src = thumbnailUrl;
        thumbnail.alt = "Видео превью";
        thumbnail.className = "video-thumbnail";
        thumbnail.loading = "lazy"; // Ленивая загрузка thumbnail
        thumbnail.onerror = () => {
            thumbnail.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjMzczODNkIi8+CjxwYXRoIGQ9Ik0xNjAgMTI1VjE3NUwyMDAgMTUwTDE2MCAxMjVaIiBmaWxsPSIjNjE2MTZiIi8+Cjwvc3ZnPg==";
        };

        // Оверлей с кнопкой play
        const overlay = document.createElement("div");
        overlay.className = "video-overlay";
        overlay.innerHTML = '<i class="fas fa-play-circle"></i>';

        // Индикатор загрузки (скрыт по умолчанию)
        const loadingIndicator = document.createElement("div");
        loadingIndicator.className = "video-loading-indicator hidden";
        loadingIndicator.innerHTML = `
            <div class="spinner"></div>
            <div class="loading-progress">0%</div>
        `;

        const durationSpan = document.createElement("span");
        durationSpan.className = "video-duration";
        durationSpan.textContent = "0:00";

        videoContainer.appendChild(thumbnail);
        videoContainer.appendChild(overlay);
        videoContainer.appendChild(loadingIndicator);
        videoContainer.appendChild(durationSpan);
        contentDiv.appendChild(videoContainer);

        // Ленивая загрузка длительности видео только когда элемент виден
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadVideoDuration(videoUrl, durationSpan);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        observer.observe(videoContainer);

        // Клик по видео открывает плеер
        videoContainer.addEventListener("click", () => {
            this.openVideoPlayer(videoUrl, thumbnailUrl);
        });

        // Проверяем статус загрузки
        if (message.is_ready === false) {
            loadingIndicator.classList.remove('hidden');
            overlay.classList.add('hidden');
        }

    } else {
        // Проверяем картинку
        const imageUrl = this.extractImageUrl(message.content);
        if (imageUrl) {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = "Фото";
            img.className = "w-32 h-32 object-cover rounded-md cursor-pointer mb-1";
            img.onerror = () => {
                img.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9IiNlZWUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNlZWUiIC8+PC9zdmc+";
            };
            img.addEventListener("click", () => {
                window.open(imageUrl, "_blank");
            });
            contentDiv.appendChild(img);

            const text = this.extractTextFromImageMessage(message.content);
            if (text) {
                const textDiv = document.createElement("div");
                textDiv.innerHTML = this.formatMessageContent(text);
                contentDiv.appendChild(textDiv);
            }
        } else {
            contentDiv.innerHTML = this.formatMessageContent(message.content);
        }
    }

    messageDiv.appendChild(contentDiv);

    const metaDiv = document.createElement('div');
    metaDiv.className = 'message-meta';
    metaDiv.innerHTML = `<span class="message-time">${time}</span>`;
    messageDiv.appendChild(metaDiv);

    return messageDiv;
}




    private openVideoPlayer(videoUrl: string, thumbnailUrl: string = ''): void {
        this.videoPlayer.open(videoUrl, thumbnailUrl);
    }

    private async getVideoThumbnail(videoUrl: string): Promise<string> {
        try {
            return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjMzczODNkIi8+CjxwYXRoIGQ9Ik0xNjAgMTI1VjE3NUwyMDAgMTUwTDE2MCAxMjVaIiBmaWxsPSIjNjE2MTZiIi8+Cjwvc3ZnPg==';
        } catch (error) {
            return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjMzczODNkIi8+CjxwYXRoIGQ9Ik0xNjAgMTI1VjE3NUwyMDAgMTUwTDE2MCAxMjVaIiBmaWxsPSIjNjE2MTZiIi8+Cjwvc3ZnPg==';
        }
    }

    private loadVideoDuration(videoUrl: string, durationElement: HTMLElement): void {
        const video = document.createElement('video');
        video.src = videoUrl;
        video.preload = 'metadata';
        
        video.addEventListener('loadedmetadata', () => {
            const minutes = Math.floor(video.duration / 60);
            const seconds = Math.floor(video.duration % 60).toString().padStart(2, '0');
            durationElement.textContent = `${minutes}:${seconds}`;
        });
        
        video.addEventListener('error', () => {
            durationElement.textContent = '0:00';
        });
    }

    private async getVideoDuration(videoUrl: string): Promise<string> {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.src = videoUrl;
            video.preload = 'metadata';
            
            video.addEventListener('loadedmetadata', () => {
                const minutes = Math.floor(video.duration / 60);
                const seconds = Math.floor(video.duration % 60).toString().padStart(2, '0');
                resolve(`${minutes}:${seconds}`);
            });
            
            video.addEventListener('error', () => {
                resolve('0:00');
            });
        });
    }

    private extractImageUrl(content: string): string | null {
        if (!content) return null;
        
        const imageRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|bmp)(\?[^\s]*)?)/gi;
        const matches = content.match(imageRegex);
        
        if (matches && matches.length > 0) {
            return matches[0];
        }
        
        return null;
    }

    private extractTextFromImageMessage(content: string): string {
        if (!content) return '';
        
        const imageUrl = this.extractImageUrl(content);
        if (!imageUrl) return content;
        
        let text = content.replace(imageUrl, '').trim();
        text = text.replace(/\n+/g, '\n').trim();
        
        return text;
    }

    private async renderMessages(messages: any): Promise<void> {
        const messagesList = document.getElementById('messagesList');
        if (!messagesList) return;

        messagesList.innerHTML = '';

        const messagesArray = this.normalizeApiResponse<Message[]>(messages);

        if (!messagesArray || messagesArray.length === 0) {
            messagesList.innerHTML = `
                <div class="empty-chat">
                    <i class="fas fa-comments"></i>
                    <p>Пока нет сообщений</p>
                    <span>Начните общение первым!</span>
                </div>
            `;
            return;
        }

        for (const message of messagesArray) {
            const isOwnMessage = message.user_id === this.currentUser?.id;
            const messageElement = await this.createMessageElement(message, isOwnMessage);
            messagesList.appendChild(messageElement);
        }

        this.scrollToBottom();
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

    private updateChatHeader(): void {
        if (!this.currentChat) return;

        const chatName = document.getElementById('currentChatName');
        const chatAvatar = document.getElementById('currentChatAvatar') as HTMLImageElement;
        const chatStatus = document.getElementById('currentChatStatus');

        const avatar = this.currentChat.avatar_url || this.currentChat.avatar || this.currentChat.url;
        const isOnline = this.currentChat.online || false;
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
            chatStatus.textContent = isOnline ? 'online' : 'offline';
            chatStatus.style.color = isOnline ? '#10b981' : '#6b7280';
        }
    }

    private showWelcomeScreen(): void {
        if (this.wsManager) {
            this.wsManager.disconnect();
            this.wsManager = null;
        }

        const welcomeSection = document.getElementById('welcomeSection');
        const chatSection = document.getElementById('chatSection');

        if (welcomeSection && chatSection) {
            chatSection.classList.add('hidden');
            welcomeSection.classList.remove('hidden');
        }
        this.currentChat = null;
        this.tempMessageIds.clear();
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

    private showError(message: string): void {
        console.error('Error:', message);
        alert(message);
    }

    private formatMessageContent(content: string | null | undefined): string {
        if (!content) return '';
        return this.escapeHtml(content).replace(/\n/g, '<br>');
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

    getChats(): Chat[] {
        return this.chats;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new HomeManager();
});