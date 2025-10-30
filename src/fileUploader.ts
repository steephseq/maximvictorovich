import { ProfileAPI } from './api.js';
import { Chat, Message, User } from './types.js';

export class FileUploader {
    private api: ProfileAPI;
    private onUploadComplete: (url: string, file: File) => void;
    private onUploadError: (error: string) => void;
    private getChatId: () => number | null;
    private getCurrentUser: () => User | null;

    constructor(
        api: ProfileAPI,
        onUploadComplete: (url: string, file: File) => void,
        onUploadError: (error: string) => void,
        getChatId: () => number | null,
        getCurrentUser: () => User | null
    ) {
        this.api = api;
        this.onUploadComplete = onUploadComplete;
        this.onUploadError = onUploadError;
        this.getChatId = getChatId;
        this.getCurrentUser = getCurrentUser;
    }

    // 🔴 ИСПРАВЛЕННЫЙ МЕТОД ЗАГРУЗКИ ФАЙЛА
    async uploadFile(file: File, progressCallback?: (messageId: number, progress: number) => void): Promise<void> {
        try {
            console.log(`🚀 Начало загрузки файла: ${file.name}`);

            if (!this.api.validateFileSize(file, 1024)) {
                throw new Error(`Файл слишком большой. Максимальный размер: 1024MB`);
            }
            
            const fileType = this.getFileTypeForBackend(file);
            const chatId = this.getChatId();
            const currentUser = this.getCurrentUser();
            
            if (!chatId) {
                throw new Error('Чат не выбран');
            }
            
            if (!currentUser) {
                throw new Error('Пользователь не авторизован');
            }

            console.log(`📁 Тип файла: ${fileType}, ID чата: ${chatId}`);

            // 1. Создаем пустое сообщение
            const messageId = await this.api.createEmptyMessage(chatId, fileType);
            console.log(`✅ Создано сообщение ID: ${messageId}`);

            // 2. Показываем временное сообщение
            this.createTempUploadMessage(messageId, file, fileType);
            
            if (progressCallback) {
                progressCallback(messageId, 10);
            }

            // 3. Загружаем файл ПРИВЯЗАННЫЙ к message_id
            console.log(`📤 Загрузка файла с привязкой к сообщению ${messageId}`);
            const fileUrl = await this.uploadFileToBackend(file, messageId);
            console.log(`✅ Файл загружен: ${fileUrl}`);

            this.updateUploadProgress(messageId, 90);
            
            // 4. Бэкенд САМ обновит сообщение через UpdateMessage в uploadFile.go
            // Нам не нужно вызывать дополнительный endpoint
            
            this.completeUpload(messageId, 100);
            
            if (progressCallback) {
                progressCallback(messageId, 100);
            }
            
            this.onUploadComplete(fileUrl, file);
            
        } catch (error: any) {
            console.error('❌ Ошибка загрузки файла:', error);
            this.onUploadError(error.message || 'Не удалось загрузить файл');
            this.removeUploadIndicator();
        }
    }

    // 🔴 НОВЫЙ МЕТОД ДЛЯ ЗАГРУЗКИ НА БЭКЕНД
    private async uploadFileToBackend(file: File, messageId: number): Promise<string> {
        const formData = new FormData();
        
        console.log(`📤 Загрузка файла: "${file.name}", тип: "${file.type}", размер: ${file.size} bytes`);
        console.log(`🔗 Message ID: ${messageId}`);
        
        formData.append('file', file);
        
        // 🔴 ВАЖНО: бекенд ожидает message_id в форме, а не в URL
        formData.append('message_id', messageId.toString());
        
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token');
            }

            const response = await fetch('https://193.47.60.194:8080/uploadFile', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // 🔴 НЕ добавляем Content-Type - браузер сам установит с boundary
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Ошибка загрузки:', response.status, errorText);
                throw new Error(`Ошибка загрузки: ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ Ответ загрузки:', result);

            // 🔴 ИСПРАВЛЕННОЕ ИЗВЛЕЧЕНИЕ URL ИЗ ОТВЕТА
            let fileUrl = '';

            if (result.Data?.filename) {
                fileUrl = result.Data.filename;
            } else if (result.data?.filename) {
                fileUrl = result.data.filename;
            } else if (result.filename) {
                fileUrl = result.filename;
            } else if (result.Data) {
                fileUrl = result.Data;
            } else if (result.data) {
                fileUrl = result.data;
            }

            if (!fileUrl) {
                console.error('❌ URL файла не найден в ответе:', result);
                throw new Error('URL файла не найден в ответе сервера');
            }

            // 🔴 ДОБАВЛЯЕМ БАЗОВЫЙ URL ЕСЛИ НУЖНО
            if (!fileUrl.startsWith('http')) {
                fileUrl = `https://storage.yandexcloud.net/your-bucket/${fileUrl}`;
            }

            console.log(`✅ Файл загружен: ${fileUrl}`);
            return fileUrl;

        } catch (error) {
            console.error('❌ Ошибка загрузки файла:', error);
            throw error;
        }
    }

    // 🔴 ИСПРАВЛЕННЫЙ МЕТОД ДЛЯ ГОЛОСОВЫХ СООБЩЕНИЙ
    async uploadVoiceMessage(audioFile: File, duration: number, progressCallback?: (messageId: number, progress: number) => void): Promise<void> {
        try {
            console.log(`🎤 Начало загрузки голосового сообщения: ${audioFile.name}, длительность: ${duration}мс`);

            if (!this.api.validateFileSize(audioFile, 50)) {
                throw new Error(`Голосовое сообщение слишком большое. Максимальный размер: 50MB`);
            }
            
            const chatId = this.getChatId();
            
            if (!chatId) {
                throw new Error('Чат не выбран');
            }

            console.log(`📝 Создание пустого сообщения для голосового`);
            
            // 1. Создаем пустое сообщение типа 'voice'
            const messageId = await this.api.createEmptyMessage(chatId, 'voice');
            console.log(`✅ Создано сообщение ID: ${messageId}`);
            
            // 2. Показываем временное сообщение
            this.createTempUploadMessage(messageId, audioFile, 'voice', duration);
            
            if (progressCallback) {
                progressCallback(messageId, 10);
            }
            
            // 3. Загружаем файл ПРИВЯЗАННЫЙ к message_id
            console.log(`📤 Загрузка голосового с привязкой к сообщению ${messageId}`);
            const fileUrl = await this.uploadFileToBackend(audioFile, messageId);
            console.log(`✅ Голосовое загружено: ${fileUrl}`);
            
            this.updateUploadProgress(messageId, 90);
            
            // 4. Бэкенд САМ обновит сообщение (filename и duration) через UpdateMessage
            
            this.completeUpload(messageId, 100);
            
            if (progressCallback) {
                progressCallback(messageId, 100);
            }
            
            console.log(`✅ Голосовое сообщение успешно отправлено`);
            
        } catch (error: any) {
            console.error('❌ Ошибка загрузки голосового сообщения:', error);
            this.onUploadError(error.message || 'Не удалось отправить голосовое сообщение');
            this.removeUploadIndicator();
        }
    }

    // 🔴 ИСПРАВЛЕННОЕ ОПРЕДЕЛЕНИЕ ТИПА ДЛЯ БЭКЕНДА
    private getFileTypeForBackend(file: File): string {
        const extension = file.name.toLowerCase().split('.').pop();
        
        // Соответствует вашим бекенд-проверкам
        const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'heic'];
        const audioExts = ['mp3', 'wav', 'ogg', 'webm', 'm4a', 'aac', 'flac'];
        
        if (videoExts.includes(extension || '')) return 'video';
        if (imageExts.includes(extension || '')) return 'image';
        if (audioExts.includes(extension || '')) return 'voice';
        
        return 'file';
    }

    // 🔴 ОСТАЛЬНЫЕ МЕТОДЫ БЕЗ ИЗМЕНЕНИЙ
    private createTempUploadMessage(messageId: number, file: File, fileType: string, duration?: number): void {
        const messagesList = document.getElementById('messagesList');
        if (!messagesList) return;

        const emptyState = messagesList.querySelector('.empty-chat');
        if (emptyState) {
            emptyState.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message message-own message-uploading';
        messageDiv.setAttribute('data-message-id', messageId.toString());
        messageDiv.setAttribute('data-upload-message', 'true');

        const time = new Date().toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        const uploadContainer = document.createElement('div');
        uploadContainer.className = `message-${fileType} message-upload-container`;
        
        const preview = document.createElement('div');
        preview.className = 'upload-preview';
        
        if (fileType === 'voice') {
            const voicePreview = document.createElement('div');
            voicePreview.className = 'voice-upload-preview';
            voicePreview.innerHTML = `
                <div class="voice-waveform">
                    <div class="wave-bar"></div>
                    <div class="wave-bar"></div>
                    <div class="wave-bar"></div>
                    <div class="wave-bar"></div>
                    <div class="wave-bar"></div>
                </div>
                <div class="voice-info">
                    <i class="fas fa-microphone"></i>
                    <span>Голосовое сообщение</span>
                </div>
            `;
            preview.appendChild(voicePreview);
        } else if (fileType === 'image') {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.alt = "Загрузка...";
            img.className = "upload-preview-image";
            preview.appendChild(img);
        } else if (fileType === 'video') {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.muted = true;
            video.className = "upload-preview-video";
            preview.appendChild(video);
        }
        
        const uploadIndicator = document.createElement('div');
        uploadIndicator.className = 'upload-indicator';
        uploadIndicator.innerHTML = `
            <div class="upload-spinner"></div>
            <div class="upload-progress">0%</div>
            <div class="upload-text">Отправка...</div>
        `;
        
        uploadContainer.appendChild(preview);
        uploadContainer.appendChild(uploadIndicator);
        contentDiv.appendChild(uploadContainer);
        
        messageDiv.appendChild(contentDiv);

        const metaDiv = document.createElement('div');
        metaDiv.className = 'message-meta';
        
        let durationText = '';
        if (duration && fileType === 'voice') {
            const seconds = Math.floor(duration / 1000);
            durationText = ` • ${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
        }
        
        metaDiv.innerHTML = `<span class="message-time">${time}${durationText}</span>`;
        messageDiv.appendChild(metaDiv);

        messagesList.appendChild(messageDiv);
        this.scrollToBottom();
    }

    private updateUploadProgress(messageId: number, progress: number): void {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"][data-upload-message="true"]`);
        if (!messageElement) return;
    
        const progressElement = messageElement.querySelector('.upload-progress') as HTMLElement;
        if (progressElement) {
            progressElement.textContent = `${progress}%`;
        }
    }

    private completeUpload(messageId: number, progress: number): void {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"][data-upload-message="true"]`);
        if (!messageElement) return;

        this.updateUploadProgress(messageId, progress);
        messageElement.classList.add('upload-complete');
        
        setTimeout(() => {
            messageElement.classList.remove('message-uploading', 'upload-complete');
            messageElement.removeAttribute('data-upload-message');
            
            const uploadIndicator = messageElement.querySelector('.upload-indicator');
            if (uploadIndicator) {
                uploadIndicator.remove();
            }
        }, 1000);
    }

    private removeUploadIndicator(): void {
        const uploadMessages = document.querySelectorAll('[data-upload-message="true"]');
        uploadMessages.forEach(message => {
            message.remove();
        });
    }

    private scrollToBottom(): void {
        const container = document.getElementById('messagesContainer');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    createFileInput(accept: string = '*'): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.style.display = 'none';
        
        input.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            if (target.files && target.files[0]) {
                const selectedFile = target.files[0];
                console.log(`📁 Выбран файл: ${selectedFile.name}`);
                this.uploadFile(selectedFile);
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
                console.log(`📁 Файл перетащен: ${file.name}`);
                this.uploadFile(file);
            }
        });
    }

    getFileShortDescription(fileType: string, fileName: string): string {
        switch (fileType) {
            case 'image': return '📷 Фото';
            case 'video': return '🎥 Видео';
            case 'audio': return '🎵 Аудио';
            case 'voice': return '🎤 Голосовое';
            case 'pdf': return '📄 Документ';
            case 'document': return '📄 Документ';
            default: return '📎 Файл';
        }
    }
}