export class ImageViewer {
    private modal: HTMLDivElement;
    private image!: HTMLImageElement;
    private closeBtn!: HTMLButtonElement;
    private overlay!: HTMLDivElement;
    private container!: HTMLDivElement;
    
    // Pan and zoom variables
    private scale: number = 1;
    private minScale: number = 0.5;
    private maxScale: number = 4;
    private isPanning: boolean = false;
    private startPanX: number = 0;
    private startPanY: number = 0;
    private panX: number = 0;
    private panY: number = 0;

    constructor() {
        // Используем существующий элемент вместо создания нового
        this.modal = document.getElementById('imageViewerModal') as HTMLDivElement;
        
        if (!this.modal) {
            console.error('❌ ImageViewer modal not found in DOM');
            return;
        }

        this.image = this.modal.querySelector('#viewerImage') as HTMLImageElement;
        this.closeBtn = this.modal.querySelector('.image-viewer-close') as HTMLButtonElement;
        this.overlay = this.modal.querySelector('.image-viewer-overlay') as HTMLDivElement;
        this.container = this.modal.querySelector('.image-viewer-container') as HTMLDivElement;
        
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.closeBtn.addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', () => this.close());
        
        // Keyboard events
        document.addEventListener('keydown', (e: KeyboardEvent) => this.handleKeyPress(e));
        
        // Zoom controls
        const zoomInBtn = this.modal.querySelector('.zoom-in-btn') as HTMLButtonElement;
        const zoomOutBtn = this.modal.querySelector('.zoom-out-btn') as HTMLButtonElement;
        const resetZoomBtn = this.modal.querySelector('.reset-zoom-btn') as HTMLButtonElement;
        
        // Останавливаем всплытие событий для кнопок зума
        zoomInBtn.addEventListener('click', (e: Event) => {
            e.stopPropagation();
            this.zoomIn();
        });
        
        zoomOutBtn.addEventListener('click', (e: Event) => {
            e.stopPropagation();
            this.zoomOut();
        });
        
        resetZoomBtn.addEventListener('click', (e: Event) => {
            e.stopPropagation();
            this.resetZoom();
        });
        
        // Mouse wheel for zoom
        this.container.addEventListener('wheel', (e: WheelEvent) => this.handleWheel(e), { passive: false });
        
        // Pan events
        this.setupPanEvents();
    }

    public open(imageUrl: string, filename: string = ''): void {
        console.log('🎯 ImageViewer.open вызван:', { imageUrl, filename });
        
        if (!this.modal) {
            console.error('❌ ImageViewer modal not initialized');
            return;
        }
        
        // Reset transformations
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.updateImageTransform();
        
        // Убираем класс hidden и добавляем active
        this.modal.classList.remove('hidden');
        this.modal.classList.add('active');
        
        // Сначала сбрасываем src чтобы избежать кэширования старого изображения
        this.image.src = '';
        
        document.body.style.overflow = 'hidden';

        // Load image
        const img = new Image();
        img.onload = () => {
            console.log('✅ Изображение загружено в ImageViewer');
            this.image.src = imageUrl;
            this.image.alt = filename || 'Просмотр изображения';
        };
        
        img.onerror = () => {
            console.error('❌ Ошибка загрузки изображения в ImageViewer:', imageUrl);
            window.open(imageUrl, '_blank');
            this.close();
        };
        
        img.src = imageUrl;
    }

    public close(): void {
        if (!this.modal) return;
        
        this.modal.classList.remove('active');
        this.modal.classList.add('hidden');
        document.body.style.overflow = '';
        
        // Reset image
        setTimeout(() => {
            this.image.src = '';
            this.image.style.transform = '';
        }, 300);
    }

    private handleKeyPress(e: KeyboardEvent): void {
        if (!this.modal.classList.contains('active')) return;

        switch (e.code) {
            case 'Escape':
                this.close();
                break;
            case 'Equal':
            case 'NumpadAdd':
                e.preventDefault();
                this.zoomIn();
                break;
            case 'Minus':
            case 'NumpadSubtract':
                e.preventDefault();
                this.zoomOut();
                break;
            case 'Digit0':
                e.preventDefault();
                this.resetZoom();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.pan(-50, 0);
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.pan(50, 0);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.pan(0, -50);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.pan(0, 50);
                break;
        }
    }

    private handleWheel(e: WheelEvent): void {
        e.preventDefault();
        
        const zoomIntensity = 0.1;
        const wheel = e.deltaY < 0 ? 1 : -1;
        const zoom = Math.exp(wheel * zoomIntensity);
        
        // Calculate new scale with limits
        const newScale = this.scale * zoom;
        if (newScale < this.minScale || newScale > this.maxScale) return;
        
        this.scale = newScale;
        this.updateImageTransform();
    }

    private zoomIn(): void {
        const zoomFactor = 1.25;
        const newScale = this.scale * zoomFactor;
        
        if (newScale <= this.maxScale) {
            this.scale = newScale;
            this.updateImageTransform();
        }
    }

    private zoomOut(): void {
        const zoomFactor = 0.8;
        const newScale = this.scale * zoomFactor;
        
        if (newScale >= this.minScale) {
            this.scale = newScale;
            this.updateImageTransform();
        }
    }

    private resetZoom(): void {
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.updateImageTransform();
    }

    private pan(deltaX: number, deltaY: number): void {
        if (this.scale > 1) {
            this.panX += deltaX;
            this.panY += deltaY;
            this.updateImageTransform();
        }
    }

    private updateImageTransform(): void {
        this.image.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    }

    private setupPanEvents(): void {
        // Mouse down - start panning
        this.container.addEventListener('mousedown', (e: MouseEvent) => {
            if (this.scale > 1) {
                this.isPanning = true;
                this.startPanX = e.clientX - this.panX;
                this.startPanY = e.clientY - this.panY;
                this.container.style.cursor = 'grabbing';
                this.image.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });

        // Mouse move - pan the image
        document.addEventListener('mousemove', (e: MouseEvent) => {
            if (!this.isPanning) return;
            
            this.panX = e.clientX - this.startPanX;
            this.panY = e.clientY - this.startPanY;
            
            this.updateImageTransform();
        });

        // Mouse up - stop panning
        document.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                this.container.style.cursor = 'grab';
                this.image.style.cursor = 'grab';
            }
        });

        // Touch events for mobile panning
        this.container.addEventListener('touchstart', (e: TouchEvent) => {
            if (e.touches.length === 1 && this.scale > 1) {
                this.isPanning = true;
                this.startPanX = e.touches[0].clientX - this.panX;
                this.startPanY = e.touches[0].clientY - this.panY;
                e.preventDefault();
            }
        });

        document.addEventListener('touchmove', (e: TouchEvent) => {
            if (!this.isPanning || e.touches.length !== 1) return;
            
            this.panX = e.touches[0].clientX - this.startPanX;
            this.panY = e.touches[0].clientY - this.startPanY;
            
            this.updateImageTransform();
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchend', () => {
            this.isPanning = false;
        });

        // Double click to reset zoom
        this.container.addEventListener('dblclick', (e: Event) => {
            e.stopPropagation(); // Предотвращаем всплытие
            this.resetZoom();
        });
    }
}