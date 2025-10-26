export class VideoPlayer {
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