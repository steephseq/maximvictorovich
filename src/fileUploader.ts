import { ProfileAPI } from './api.js';
import { Chat, Message, User } from './types.js';

export class FileUploader {
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
                const messageId = await this.api.createEmptyMessage(chatId, 'video');
                
                const thumbnail = await this.createVideoThumbnail(file);
                
                if (progressCallback) {
                    progressCallback(messageId, 0);
                }
                
                const fileUrl = await this.api.uploadFile(file, messageId);
                
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
                video.currentTime = 1;
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
                const selectedFile = target.files[0];
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
                this.uploadFile(file);
            }
        });
    }

    getFileShortDescription(fileType: string, fileName: string): string {
        switch (fileType) {
            case 'image': return '📷 Фото';
            case 'video': return '🎥 Видео';
            case 'audio': return '🎵 Аудио';
            case 'pdf': return '📄 Документ';
            case 'document': return '📄 Документ';
            default: return '📎 Файл';
        }
    }
}