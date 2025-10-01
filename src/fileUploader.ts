import { ProfileAPI } from './api.js';

export class FileUploader {
    private api: ProfileAPI;
    private onUploadComplete: (url: string, file: File) => void;
    private onUploadError: (error: string) => void;
    private onProgress?: (progress: number) => void;

    constructor(
        api: ProfileAPI,
        onUploadComplete: (url: string, file: File) => void,
        onUploadError: (error: string) => void,
        onProgress?: (progress: number) => void
    ) {
        this.api = api;
        this.onUploadComplete = onUploadComplete;
        this.onUploadError = onUploadError;
        this.onProgress = onProgress;
    }

    // Основной метод загрузки
    async uploadFile(file: File): Promise<void> {
        try {
            // Проверяем размер файла
            if (!this.api.validateFileSize(file, 20)) {
                throw new Error(`Файл слишком большой. Максимальный размер: 20MB`);
            }

            console.log('🔄 Начинаем загрузку файла:', file.name);
            
            // Здесь можно добавить отслеживание прогресса если нужно
            if (this.onProgress) {
                this.onProgress(10); // Начало загрузки
            }

            // Загружаем файл
            const fileUrl = await this.api.uploadFile(file);
            
            if (this.onProgress) {
                this.onProgress(100); // Загрузка завершена
            }

            console.log('✅ Файл успешно загружен:', fileUrl);
            this.onUploadComplete(fileUrl, file);

        } catch (error: any) {
            console.error('❌ Ошибка загрузки файла:', error);
            this.onUploadError(error.message || 'Не удалось загрузить файл');
        }
    }

    // Метод для создания input элемента
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
            // Сбрасываем значение чтобы можно было выбрать тот же файл снова
            target.value = '';
        });

        document.body.appendChild(input);
        return input;
    }

    // Метод для drag and drop
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