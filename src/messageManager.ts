import { ProfileAPI } from './api.js';
import { Message, User, Chat } from './types.js';
import { VideoPlayer } from './videoPlayer.js';
import { WebSocketManager } from './websocket.js';
import { ImageViewer } from './imageViewer.js';
import { FileUploader } from './fileUploader.js';

export class MessageManager {
    private api: ProfileAPI;
    private videoPlayer: VideoPlayer;
    private imageViewer: ImageViewer; // Добавьте это поле
    private currentUser: User | null = null;
    private currentChat: Chat | null = null;
    private wsManager: WebSocketManager | null = null;
    private tempMessageIds: Set<string> = new Set();
    private fileUploader: FileUploader;

    constructor(api: ProfileAPI, videoPlayer: VideoPlayer) {
        this.api = api;
        this.videoPlayer = videoPlayer;
        this.imageViewer = new ImageViewer();
        
        // Инициализируем FileUploader
        this.fileUploader = new FileUploader(
            api,
            (url: string, file: File) => this.onFileUploadComplete(url, file),
            (error: string) => this.showError(error),
            () => this.currentChat?.id || null,
            () => this.currentUser
        );
    }

    setCurrentUser(user: User): void {
        this.currentUser = user;
    }

    setCurrentChat(chat: Chat): void {
        this.currentChat = chat;
    }

    setupMessageSending(): void {
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

    private async sendVoiceMessage(audioFile: File, duration: number): Promise<void> {
        try {
            console.log('📤 Отправка голосового сообщения...');

            // Используем FileUploader для загрузки голосового
            await this.fileUploader.uploadVoiceMessage(audioFile, duration);
            
            console.log('✅ Голосовое сообщение отправлено через FileUploader');

        } catch (error) {
            console.error('❌ Ошибка отправки голосового сообщения:', error);
            this.showError('Не удалось отправить голосовое сообщение');
        }
    }
    private onFileUploadComplete(url: string, file: File): void {
        console.log(`✅ Файл загружен: ${url}`);
        // Файл уже обработан через временное сообщение, ничего дополнительно делать не нужно
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

    async renderMessages(messages: any): Promise<void> {
        const messagesList = document.getElementById('messagesList');
        if (!messagesList) return;
    
        // 🔴 НЕ УДАЛЯЕМ СООБЩЕНИЯ С ИНДИКАТОРОМ ЗАГРУЗКИ
        const uploadMessages = messagesList.querySelectorAll('[data-upload-message="true"]');
        const otherMessages = Array.from(messagesList.children).filter(child => 
            !child.hasAttribute('data-upload-message')
        );
        
        // Удаляем только обычные сообщения
        otherMessages.forEach(child => child.remove());
    
        const messagesArray = this.normalizeApiResponse<Message[]>(messages);
    
        console.log('📨 Сообщения для рендеринга:', messagesArray);
        
        messagesArray.forEach((message, index) => {
            console.log(`📄 Сообщение ${index}:`, {
                id: message.id,
                type: message.type,
                content: message.content,
                filename: message.filename
            });
        });
    
        if ((!messagesArray || messagesArray.length === 0) && uploadMessages.length === 0) {
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
            // 🔴 ПРОПУСКАЕМ СООБЩЕНИЯ, КОТОРЫЕ ЗАГРУЖАЮТСЯ
            const existingUploadMessage = messagesList.querySelector(`[data-message-id="${message.id}"][data-upload-message="true"]`);
            if (existingUploadMessage) {
                continue;
            }
            
            const isOwnMessage = message.user_id === this.currentUser?.id;
            const messageElement = await this.createMessageElement(message, isOwnMessage);
            messagesList.appendChild(messageElement);
        }
    
        this.scrollToBottom();
    }

    private async createMessageElement(message: Message, isOwnMessage: boolean): Promise<HTMLElement> {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwnMessage ? 'message-own' : 'message-other'}`;
        messageDiv.setAttribute('data-message-id', message.id.toString());
    
        const time = new Date(message.created_at).toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
    
        // 🔴 ДОБАВЛЯЕМ ОБРАБОТКУ ГОЛОСОВЫХ СООБЩЕНИЙ
        if (message.type === 'voice') {
            await this.renderVoiceMessage(contentDiv, message);
        } else if (message.type === 'video') {
            await this.renderVideoMessage(contentDiv, message);
        } else if (message.type === 'image') {
            await this.renderImageMessage(contentDiv, message);
        } else {
            await this.renderTextMessage(contentDiv, message);
        }
    
        messageDiv.appendChild(contentDiv);
    
        const metaDiv = document.createElement('div');
        metaDiv.className = 'message-meta';
        
        let metaHTML = `<span class="message-time">${time}</span>`;
        
        // Добавляем имя пользователя для чужих сообщений в групповых чатах
        if (!isOwnMessage && this.currentChat?.is_group) {
            metaHTML = `<span class="message-author">${message.name}</span> • ${metaHTML}`;
        }
        
        metaDiv.innerHTML = metaHTML;
        messageDiv.appendChild(metaDiv);
    
        // ... остальная часть метода без изменений
        return messageDiv;
    }

    private async renderVoiceMessage(contentDiv: HTMLElement, message: Message): Promise<void> {
        const audioUrl = message.url || (typeof message.content === 'string' ? message.content : '');
        const duration = message.duration || 0;

        const voiceContainer = document.createElement('div');
    voiceContainer.className = 'message-voice';
    voiceContainer.dataset.audioUrl = audioUrl;
    voiceContainer.dataset.messageId = message.id.toString();

        const voicePlayer = document.createElement('div');
        voicePlayer.className = 'voice-player';

        const playButton = document.createElement('button');
        playButton.className = 'voice-play-btn';
        playButton.innerHTML = '<i class="fas fa-play"></i>';
        
        const progressContainer = document.createElement('div');
        progressContainer.className = 'voice-progress';
        
        const progressBar = document.createElement('div');
        progressBar.className = 'voice-progress-bar';
        
        const durationSpan = document.createElement('span');
        durationSpan.className = 'voice-duration';
        
        // Форматируем длительность
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        durationSpan.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        progressContainer.appendChild(progressBar);
        
        voicePlayer.appendChild(playButton);
        voicePlayer.appendChild(progressContainer);
        voicePlayer.appendChild(durationSpan);
        
        voiceContainer.appendChild(voicePlayer);
        contentDiv.appendChild(voiceContainer);

        // Обработчик воспроизведения
        this.setupVoicePlayer(playButton, progressBar, durationSpan, audioUrl);
    }

    private setupVoicePlayer(
        playButton: HTMLButtonElement, 
        progressBar: HTMLElement, 
        durationSpan: HTMLElement, 
        audioUrl: string
    ): void {
        let audio: HTMLAudioElement | null = null;
        let isPlaying = false;

        playButton.addEventListener('click', async () => {
            if (!audio) {
                audio = new Audio(audioUrl);
                
                audio.addEventListener('loadedmetadata', () => {
                    console.log('✅ Аудио загружено, длительность:', audio?.duration);
                });
                
                audio.addEventListener('timeupdate', () => {
                    if (audio) {
                        const progress = (audio.currentTime / audio.duration) * 100;
                        progressBar.style.width = `${progress}%`;
                    }
                });
                
                audio.addEventListener('ended', () => {
                    isPlaying = false;
                    playButton.innerHTML = '<i class="fas fa-play"></i>';
                    progressBar.style.width = '0%';
                });
                
                audio.addEventListener('error', (e) => {
                    console.error('❌ Ошибка воспроизведения аудио:', e);
                    this.showError('Не удалось воспроизвести голосовое сообщение');
                });
            }

            if (isPlaying) {
                audio.pause();
                isPlaying = false;
                playButton.innerHTML = '<i class="fas fa-play"></i>';
            } else {
                try {
                    await audio.play();
                    isPlaying = true;
                    playButton.innerHTML = '<i class="fas fa-pause"></i>';
                } catch (error) {
                    console.error('❌ Ошибка воспроизведения:', error);
                    this.showError('Не удалось воспроизвести аудио');
                }
            }
        });
    }
    private async renderVideoMessage(contentDiv: HTMLElement, message: Message): Promise<void> {
        const videoUrl = message.url || (typeof message.content === 'string' ? message.content : '');
        const thumbnailUrl = message.thumbnail || message.filename || '';
    
        const videoContainer = document.createElement("div");
        videoContainer.className = "message-video";
        videoContainer.dataset.videoUrl = videoUrl;
        videoContainer.dataset.messageId = message.id.toString();

        const thumbnail = document.createElement("img");
    thumbnail.src = thumbnailUrl || "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjMzczODNkIi8+CjxwYXRoIGQ9Ik0xNjAgMTI1VjE3NUwyMDAgMTUwTDE2MCAxMjVaIiBmaWxsPSIjNjE2MTZiIi8+Cjwvc3ZnPg==";
    thumbnail.alt = "Видео превью";
    thumbnail.className = "video-thumbnail";
        thumbnail.loading = "lazy";
        thumbnail.onerror = () => {
            thumbnail.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjMzczODNkIi8+CjxwYXRoIGQ9Ik0xNjAgMTI1VjE3NUwyMDAgMTUwTDE2MCAxMjVaIiBmaWxsPSIjNjE2MTZiIi8+Cjwvc3ZnPg==";
        };

        const overlay = document.createElement("div");
        overlay.className = "video-overlay";
        overlay.innerHTML = '<i class="fas fa-play-circle"></i>';

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

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadVideoDuration(videoUrl, durationSpan);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        observer.observe(videoContainer);

        videoContainer.addEventListener("click", () => {
            this.videoPlayer.open(videoUrl, thumbnailUrl);
        });

        if (message.is_ready === false) {
            loadingIndicator.classList.remove('hidden');
            overlay.classList.add('hidden');
        }

        // Если есть дополнительный текст в content (помимо URL)
        const additionalText = this.extractAdditionalText(message.content, videoUrl);
        if (additionalText) {
            const textDiv = document.createElement("div");
            textDiv.innerHTML = this.formatMessageContent(additionalText);
            textDiv.style.marginTop = '8px';
            contentDiv.appendChild(textDiv);
        }
    }

    private async renderImageMessage(contentDiv: HTMLElement, message: Message): Promise<void> {
        const imageUrl = message.url || (typeof message.content === 'string' ? message.content : '');        const thumbnailUrl = message.filename || imageUrl;
    
        console.log('🖼️ Рендеринг изображения:', { imageUrl, thumbnailUrl, message });
    
        const imageContainer = document.createElement('div');
        imageContainer.className = 'message-image'; // Убедитесь что это правильный класс
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = "Фото";
        img.className = "image-preview";
        
        img.loading = "lazy";
        
        // УБЕРИТЕ ВСЕ ИНЛАЙН-СТИЛИ которые могут добавлять обводку
        img.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 12px;
            display: block;
        `;
        
        // Индикатор загрузки (упрощенный)
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'image-loading-indicator';
        loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        img.onerror = () => {
            console.error('❌ Ошибка загрузки изображения:', imageUrl);
            loadingIndicator.remove();
            img.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9IiNlZWUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNlZWUiIC8+PC9zdmc+";
            
            const fallbackText = document.createElement('div');
            fallbackText.className = 'image-fallback';
            fallbackText.textContent = `📷 Изображение: ${this.getFileNameFromUrl(imageUrl)}`;
            fallbackText.style.cssText = `
                padding: 8px;
                background: rgba(255,255,255,0.1);
                border-radius: 4px;
                margin-top: 8px;
                word-break: break-all;
                font-size: 0.8rem;
                color: #a78bfa;
                text-align: center;
            `;
            imageContainer.appendChild(fallbackText);
        };
        
        img.onload = () => {
            loadingIndicator.remove();
            console.log('✅ Изображение загружено:', imageUrl);
        };
        
        imageContainer.appendChild(loadingIndicator);
        imageContainer.appendChild(img);
        
        // Обработчик клика
        imageContainer.addEventListener("click", (e) => {
            console.log('🖱️ Клик по изображению:', { 
                imageUrl, 
                filename: message.filename,
                event: e 
            });
            this.imageViewer.open(imageUrl, message.filename || this.getFileNameFromUrl(imageUrl));
        });
        
        contentDiv.appendChild(imageContainer);
    
        // Если есть дополнительный текст в content (помимо URL)
        const additionalText = this.extractAdditionalText(message.content, imageUrl);
        if (additionalText) {
            const textDiv = document.createElement("div");
            textDiv.innerHTML = this.formatMessageContent(additionalText);
            textDiv.style.marginTop = '8px';
            contentDiv.appendChild(textDiv);
        }
    }

    private openImageViewer(imageUrl: string, filename: string = ''): void {
        this.imageViewer.open(imageUrl, filename);
    }

    private async renderTextMessage(contentDiv: HTMLElement, message: Message): Promise<void> {
        const content = typeof message.content === 'string' ? message.content : String(message.content);
        
        // Проверяем legacy форматы (ссылки на изображения/видео в тексте)
        const imageUrl = this.extractImageUrl(content);
        const videoUrl = this.extractVideoUrl(content);
        
        if (videoUrl) {
            // Обработка видео из текста (старый формат)
            await this.renderLegacyVideoMessage(contentDiv, message, videoUrl);
        } else if (imageUrl) {
            // Обработка изображений из текста (старый формат)
            await this.renderLegacyImageMessage(contentDiv, message, imageUrl);
        } else {
            // Обычное текстовое сообщение
            contentDiv.innerHTML = this.formatMessageContent(content);
        }
    }

    private async renderLegacyVideoMessage(contentDiv: HTMLElement, message: Message, videoUrl: string): Promise<void> {
        const content = typeof message.content === 'string' ? message.content : String(message.content);
        
        const videoContainer = document.createElement("div");
        videoContainer.className = "message-video";
        videoContainer.dataset.videoUrl = videoUrl;
        videoContainer.dataset.messageId = message.id.toString();
    
        const thumbnail = document.createElement("img");
        thumbnail.src = message.filename || "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjMzczODNkIi8+CjxwYXRoIGQ9Ik0xNjAgMTI1VjE3NUwyMDAgMTUwTDE2MCAxMjVaIiBmaWxsPSIjNjE2MTZiIi8+Cjwvc3ZnPg==";
        thumbnail.alt = "Видео превью";
        thumbnail.className = "video-thumbnail";
        thumbnail.loading = "lazy";
    
        const overlay = document.createElement("div");
        overlay.className = "video-overlay";
        overlay.innerHTML = '<i class="fas fa-play-circle"></i>';
    
        const durationSpan = document.createElement("span");
        durationSpan.className = "video-duration";
        durationSpan.textContent = "0:00";
    
        videoContainer.appendChild(thumbnail);
        videoContainer.appendChild(overlay);
        videoContainer.appendChild(durationSpan);
        contentDiv.appendChild(videoContainer);
    
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadVideoDuration(videoUrl, durationSpan);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        observer.observe(videoContainer);
    
        videoContainer.addEventListener("click", () => {
            this.videoPlayer.open(videoUrl, message.filename || '');
        });
    
        // Добавляем текст если есть что-то кроме видео ссылки
        const textWithoutVideo = content.replace(videoUrl, '').trim();
        if (textWithoutVideo) {
            const textDiv = document.createElement("div");
            textDiv.innerHTML = this.formatMessageContent(textWithoutVideo);
            textDiv.style.marginTop = '8px';
            contentDiv.appendChild(textDiv);
        }
    }
    
    private async renderLegacyImageMessage(contentDiv: HTMLElement, message: Message, imageUrl: string): Promise<void> {
        const content = typeof message.content === 'string' ? message.content : String(message.content);
        
        const imageContainer = document.createElement('div');
        imageContainer.className = 'message-image';
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = "Фото";
        img.className = "image-preview";
        img.loading = "lazy";
        
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'image-loading-indicator';
        loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        loadingIndicator.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #8b5cf6;
            font-size: 1.5rem;
        `;
        
        img.onerror = () => {
            loadingIndicator.remove();
            img.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9IiNlZWUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNlZWUiIC8+PC9zdmc+";
        };
        
        img.onload = () => {
            loadingIndicator.remove();
        };
        
        imageContainer.appendChild(loadingIndicator);
        imageContainer.appendChild(img);
        
        imageContainer.addEventListener("click", () => {
            window.open(imageUrl, "_blank");
        });
        
        contentDiv.appendChild(imageContainer);
    
        // Добавляем текст если есть что-то кроме картинки
        const textWithoutImage = this.extractTextFromImageMessage(content);
        if (textWithoutImage) {
            const textDiv = document.createElement("div");
            textDiv.innerHTML = this.formatMessageContent(textWithoutImage);
            textDiv.style.marginTop = '8px';
            contentDiv.appendChild(textDiv);
        }
    }

    private getFileNameFromUrl(url: string): string {
        try {
            return url.split('/').pop() || url;
        } catch {
            return url;
        }
    }

    private extractAdditionalText(content: any, mediaUrl: string): string {
        if (typeof content !== 'string') return '';
        
        // Если content это просто URL медиа, то текста нет
        if (content.trim() === mediaUrl) return '';
        
        // Иначе возвращаем content без URL медиа
        return content.replace(mediaUrl, '').trim();
    }

    setupMessageActions(): void {
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const messageActionsBtn = target.closest('.message-actions-btn');
            
            if (messageActionsBtn) {
                e.stopPropagation();
                const messageElement = messageActionsBtn.closest('.message') as HTMLElement;
                const messageId = messageElement?.getAttribute('data-message-id');
                const chatId = this.currentChat?.id;
                
                if (messageId && chatId) {
                    this.showMessageActions(parseInt(messageId), chatId, messageElement);
                }
            }
        });
    }

    private async showMessageActions(messageId: number, chatId: number, messageElement: HTMLElement): Promise<void> {
        try {
            const actions = await this.api.getAvailableMessageActions(chatId, messageId);
            this.showMessageActionsMenu(actions, messageId, messageElement);
        } catch (error) {
            console.error('❌ Ошибка получения действий для сообщения:', error);
            this.showError('Не удалось загрузить доступные действия');
        }
    }

    public disconnectWebSocket(): void {
        if (this.wsManager) {
            this.wsManager.disconnect();
            this.wsManager = null;
        }
    }

    private showMessageActionsMenu(actions: any, messageId: number, messageElement: HTMLElement): void {
        const normalizedActions = {
            CanEditMessage: actions.can_edit_message || actions.CanEditMessage || false,
            CanDeleteMessage: actions.can_delete_message || actions.CanDeleteMessage || false
        };
    
        const menu = document.createElement('div');
        menu.className = 'message-actions-menu';
        menu.style.cssText = `
            position: absolute;
            background: linear-gradient(135deg, #2d1b69 0%, #1a1033 100%);
            border: 1px solid rgba(139, 92, 246, 0.3);
            border-radius: 12px;
            padding: 0.5rem;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            min-width: 150px;
            backdrop-filter: blur(20px);
        `;
    
        if (normalizedActions.CanEditMessage) {
            const editBtn = this.createActionButton('Редактировать', 'fas fa-edit', () => {
                this.editMessage(messageId, messageElement);
                this.closeMessageActionsMenu();
            });
            menu.appendChild(editBtn);
        }
    
        if (normalizedActions.CanDeleteMessage) {
            const deleteBtn = this.createActionButton('Удалить', 'fas fa-trash', () => {
                this.deleteMessage(messageId);
                this.closeMessageActionsMenu();
            }, true);
            menu.appendChild(deleteBtn);
        }
    
        if (!normalizedActions.CanEditMessage && !normalizedActions.CanDeleteMessage) {
            const noActions = document.createElement('div');
            noActions.className = 'no-actions-message';
            noActions.textContent = 'Нет доступных действий';
            noActions.style.cssText = `
                padding: 0.5rem 0.75rem;
                color: #a78bfa;
                font-size: 0.9rem;
                text-align: center;
            `;
            menu.appendChild(noActions);
        }
    
        const rect = messageElement.getBoundingClientRect();
        menu.style.top = `${rect.top + window.scrollY - 10}px`;
        menu.style.left = `${rect.right - 180}px`;
    
        document.body.appendChild(menu);
    
        const closeHandler = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) {
                this.closeMessageActionsMenu();
                document.removeEventListener('click', closeHandler);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeHandler);
        }, 0);
    }

    private createActionButton(text: string, icon: string, onClick: () => void, isDanger: boolean = false): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = `message-action-btn ${isDanger ? 'danger' : ''}`;
        button.style.cssText = `
            display: flex;
            align-items: center;
            gap: 0.5rem;
            width: 100%;
            padding: 0.5rem 0.75rem;
            border: none;
            border-radius: 8px;
            background: transparent;
            color: ${isDanger ? '#ef4444' : '#f8fafc'};
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 0.9rem;
        `;
        
        button.innerHTML = `
            <i class="${icon}"></i>
            <span>${text}</span>
        `;
        
        button.addEventListener('click', onClick);
        button.addEventListener('mouseenter', () => {
            button.style.background = isDanger ? 'rgba(239, 68, 68, 0.2)' : 'rgba(139, 92, 246, 0.2)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.background = 'transparent';
        });
        
        return button;
    }

    private closeMessageActionsMenu(): void {
        const existingMenu = document.querySelector('.message-actions-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
    }

    private async editMessage(messageId: number, messageElement: HTMLElement): Promise<void> {
        const contentElement = messageElement.querySelector('.message-content');
        if (!contentElement) return;
    
        let currentContent = '';
        
        const textElement = contentElement.querySelector('div:last-child');
        if (textElement) {
            currentContent = textElement.textContent || '';
        } else {
            currentContent = contentElement.textContent || '';
        }
    
        const newContent = prompt('Редактировать сообщение:', currentContent.trim());
        
        if (newContent && newContent !== currentContent.trim() && this.currentUser && this.currentChat) {
            const originalContent = textElement ? textElement.innerHTML : contentElement.innerHTML;
            if (textElement) {
                textElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Редактирование...';
            } else {
                contentElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Редактирование...';
            }
    
            try {
                await this.api.editMessage(messageId, newContent, this.currentUser.id, this.currentChat.id);
                
                if (textElement) {
                    textElement.innerHTML = this.formatMessageContent(newContent);
                } else {
                    contentElement.innerHTML = this.formatMessageContent(newContent);
                }
                
                const metaDiv = messageElement.querySelector('.message-meta');
                if (metaDiv && !metaDiv.querySelector('.edited-badge')) {
                    const editedBadge = document.createElement('span');
                    editedBadge.className = 'edited-badge';
                    editedBadge.textContent = 'ред.';
                    editedBadge.style.cssText = `
                        color: #a78bfa;
                        font-size: 0.7rem;
                        margin-left: 0.5rem;
                        font-style: italic;
                    `;
                    metaDiv.appendChild(editedBadge);
                }
                
            } catch (error: any) {
                if (textElement) {
                    textElement.innerHTML = originalContent;
                } else {
                    contentElement.innerHTML = originalContent;
                }
                
                console.error('❌ Ошибка редактирования сообщения:', error);
                
                const errorMessage = error?.message || '';
                
                if (errorMessage.includes('403') || errorMessage.includes('Forbidden') || errorMessage.includes('Unauthorized')) {
                    this.showError('У вас нет прав для редактирования этого сообщения');
                } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
                    this.showError('Сообщение не найдено');
                } else {
                    this.showError('Не удалось отредактировать сообщение');
                }
            }
        } else if (!this.currentUser || !this.currentChat) {
            this.showError('Ошибка: пользователь или чат не определены');
        }
    }

    private async deleteMessage(messageId: number): Promise<void> {
        if (!this.currentChat) {
            this.showError('Чат не выбран');
            return;
        }
        
        if (confirm('Вы уверены, что хотите удалить это сообщение?')) {
            try {
                await this.api.deleteMessage(messageId, this.currentChat.id);
                
                const messageElement = document.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement;
                if (messageElement) {
                    messageElement.style.transition = 'all 0.3s ease';
                    messageElement.style.opacity = '0';
                    messageElement.style.transform = 'translateX(-20px)';
                    
                    setTimeout(() => {
                        messageElement.remove();
                    }, 300);
                }
            } catch (error: any) {
                console.error('❌ Ошибка удаления сообщения:', error);
                
                const errorMessage = error?.message || '';
                
                if (errorMessage.includes('403') || errorMessage.includes('permission') || errorMessage.includes('Forbidden')) {
                    this.showError('У вас нет прав для удаления этого сообщения');
                } else {
                    this.showError('Не удалось удалить сообщение');
                }
            }
        }
    }

    async connectWebSocket(chatId: number): Promise<void> {
        if (this.wsManager) {
            this.wsManager.disconnect();
            this.wsManager = null;
        }
        this.wsManager = new WebSocketManager(chatId);
        
        this.wsManager.addMessageHandler((message: Message) => {
            this.handleNewMessage(message);
        });

        try {
            await this.wsManager.connect();
        } catch (error) {
            this.showError('Не удалось подключиться к чату в реальном времени');
        }
    }

    private async handleNewMessage(message: Message): Promise<void> {
        console.log('📨 WebSocket message received:', message);
        
        // 🔴 ИСПРАВЛЕННАЯ ОБРАБОТКА ПРОФИЛЯ
        if (message.type === 'profile:update' || message.type === 'profile_update') {
            console.log('🔄 Profile update received:', message.content);
            try {
                // message.content содержит ТОЛЬКО обновленные статусы, не полный профиль
                // Нужно обновить существующий профиль, а не заменять его
                const statusUpdate = message.content;
                
                // Создаем кастомное событие с типом обновления
                const customEvent = new CustomEvent('profileStatusUpdate', { 
                    detail: {
                        type: 'status_update',
                        data: statusUpdate,
                        chatId: message.chat_id
                    }
                });
                document.dispatchEvent(customEvent);
                
            } catch (error) {
                console.error('❌ Failed to process profile update:', error);
            }
            return;
        }
        
        if (typeof message.content !== 'string') {
            console.warn('🔵 Ignoring non-string message content:', message.content);
            return;
        }
    
        // ⬇️ ТВОЙ СУЩЕСТВУЮЩИЙ КОД ⬇️
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
    
        this.updateChatPositionInSidebar(message);
        this.scrollToBottom();
    }

    private updateChatPositionInSidebar(message: Message): void {
        // Получаем ссылку на HomeManager через window или другой способ
        const homeManager = (window as any).homeManager;
        if (homeManager && homeManager.updateChatPositionOnNewMessage) {
            const lastMessage = this.formatLastMessageForChatList(message.content);
            homeManager.updateChatPositionOnNewMessage(message.chat_id, lastMessage);
        }
    }

    private formatLastMessageForChatList(content: string): string {
        if (!content) return 'Нет сообщений';
        
        // Проверяем тип контента
        if (this.containsImage(content)) {
            return '📷 Фото';
        }
        
        if (this.containsVideo(content)) {
            return '🎥 Видео';
        }
        
        if (this.containsAudio(content)) {
            return '🎵 Аудио';
        }
        
        if (this.containsDocument(content)) {
            return '📄 Документ';
        }
        
        if (this.containsFile(content)) {
            return '📎 Файл';
        }
        
        // Обрезаем длинный текст
        return this.truncateMessage(content, 50);
    }
    
    private containsImage(content: string): boolean {
        const imageRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|bmp)(\?[^\s]*)?)/gi;
        return imageRegex.test(content) || content.includes('📷');
    }
    
    private containsVideo(content: string): boolean {
        const videoRegex = /(https?:\/\/[^\s]+\.(mp4|mov|avi|mkv|webm)(\?[^\s]*)?)/gi;
        return videoRegex.test(content) || content.includes('🎥');
    }
    
    private containsAudio(content: string): boolean {
        const audioRegex = /(https?:\/\/[^\s]+\.(mp3|wav|ogg|flac)(\?[^\s]*)?)/gi;
        return audioRegex.test(content) || content.includes('🎵');
    }
    
    private containsDocument(content: string): boolean {
        const docRegex = /(https?:\/\/[^\s]+\.(pdf|doc|docx|txt)(\?[^\s]*)?)/gi;
        return docRegex.test(content) || content.includes('📄') || content.includes('📝');
    }
    
    private containsFile(content: string): boolean {
        return content.includes('📎') && content.includes('https://');
    }
    
    private truncateMessage(message: string, maxLength: number): string {
        if (message.length <= maxLength) return message;
        return message.substring(0, maxLength) + '...';
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
        if (typeof content !== 'string') return null;
        if (!content) return null;
        
        const videoRegex = /(https?:\/\/[^\s<>"]+\.(mp4|mov|avi|webm|mkv)(\?[^\s<>"]*)?)/gi;
        const matches = content.match(videoRegex);
        
        return matches && matches.length > 0 ? matches[0] : null;
    }

    private extractImageUrl(content: string): string | null {
        if (typeof content !== 'string') return null;
        if (!content) return null;
        
        const imageRegex = /(https?:\/\/[^\s<>"]+\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?[^\s<>"]*)?)/gi;
        const matches = content.match(imageRegex);
        
        return matches && matches.length > 0 ? matches[0] : null;
    }

    private extractTextFromImageMessage(content: string): string {
        if (typeof content !== 'string') {
            return '';
        }
        
        const imageUrl = this.extractImageUrl(content);
        if (!imageUrl) return content;
        
        // 🔴 ИСПРАВЛЕНИЕ: Убираем URL изображения и чистим текст
        let text = content.replace(imageUrl, '').trim();
        
        // Убираем лишние пробелы и переносы
        text = text.replace(/\s+/g, ' ').trim();
        
        // Убираем метки изображения если они есть
        text = text.replace(/\[image\]|\[img\]|📷/g, '').trim();
        
        return text;
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

    private formatMessageContent(content: string | null | undefined): string {
        if (!content) return '';
        return this.escapeHtml(content).replace(/\n/g, '<br>');
    }

    private scrollToBottom(): void {
        const container = document.getElementById('messagesContainer');
        if (container) {
            container.scrollTop = container.scrollHeight;
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
}