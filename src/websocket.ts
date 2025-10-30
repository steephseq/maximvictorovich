import { authManager } from './auth.js';
import type { Message, User, GroupProfile } from './types.js';

// =====================
// 💬 WebSocket для чата
// =====================
export class WebSocketManager {
    private ws: WebSocket | null = null;
    private chatId: number;
    private messageHandlers: ((message: Message) => void)[] = [];
    private chatUpdateHandlers: ((chatId: number, lastMessage: string) => void)[] = [];
    private reconnectInterval: number = 1000;
    private shouldReconnect: boolean = true;

    constructor(chatId: number) {
        this.chatId = chatId;
    }

    public connect(): Promise<void> {
        this.shouldReconnect = true;
        return new Promise((resolve, reject) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }

            const token = authManager.getToken();
            if (!token) {
                const errorMsg = '❌ No auth token for WebSocket';
                console.error(errorMsg);
                reject(new Error(errorMsg));
                return;
            }

            const wsUrl = `wss://193.47.60.194:8080/ws?chat_id=${this.chatId}&token=${encodeURIComponent(token)}`;
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.reconnectInterval = 1000;
                resolve();
            };

            this.ws.onmessage = (event: MessageEvent) => {
                try {
                    const data: Message & { chat_id?: number; content?: string } = JSON.parse(event.data);

                    if (data.type === 'chat_update' && data.chat_id !== undefined && data.content !== undefined) {
                        this.chatUpdateHandlers.forEach(handler => handler(data.chat_id!, data.content!));
                    } 
                    else if (data.type === 'group_profile_update') {
                        document.dispatchEvent(new CustomEvent('groupProfileUpdate', { detail: data.content }));
                    } 
                    else {
                        this.messageHandlers.forEach(handler => handler(data));
                    }
                } catch (error) {
                    console.error('❌ Error parsing WebSocket message:', error, event.data);
                }
            };

            this.ws.onclose = () => {
                if (this.shouldReconnect) {
                    setTimeout(() => this.connect(), this.reconnectInterval);
                    this.reconnectInterval = Math.min(this.reconnectInterval * 2, 30000);
                }
            };

            this.ws.onerror = (event) => {
                console.error('❌ WebSocket error:', event);
                reject(event);
            };
        });
    }

    public disconnect(): void {
        this.shouldReconnect = false;
        if (this.ws) this.ws.close();
    }

    public addMessageHandler(handler: (message: Message) => void): void {
        this.messageHandlers.push(handler);
    }

    public addChatUpdateHandler(handler: (chatId: number, lastMessage: string) => void): void {
        this.chatUpdateHandlers.push(handler);
    }

    public sendMessage(content: string, type: string = 'text'): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = { chat_id: this.chatId, content, type };
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('🚫 WebSocket is not connected. Message not sent:', content);
        }
    }
}

// ===========================================
// 🌍 Глобальный WebSocket для статусов онлайн
// ===========================================
class StatusSocket {
    private ws: WebSocket | null = null;
    private messageListeners: ((event: MessageEvent) => void)[] = [];
    private reconnectInterval: number = 1000;
    private pingInterval?: number;

    constructor() {
        this.connect();
    }

    private connect(): void {
        const token = authManager.getToken();
        if (!token) {
            console.error('❌ No auth token for status WebSocket');
            setTimeout(() => this.connect(), 5000);
            return;
        }

        const wsUrl = `wss://193.47.60.194:8080/ws/onlineStatus?token=${encodeURIComponent(token)}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            this.reconnectInterval = 1000;

            if (this.pingInterval) clearInterval(this.pingInterval);
            this.pingInterval = window.setInterval(() => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send('ping');
                }
            }, 10000);
        };

        this.ws.onmessage = (event: MessageEvent) => {
            this.messageListeners.forEach(listener => listener(event));

            try {
                const data = JSON.parse(event.data);
                if (data.type === 'status_update') {
                    document.dispatchEvent(new CustomEvent('statusUpdate', { detail: data.data }));
                }
                if (data.type === 'group_profile_update') {
                    document.dispatchEvent(new CustomEvent('groupProfileUpdate', { detail: data.content }));
                }
            } catch (err) {
                console.error("❌ Error parsing global WS message:", err, event.data);
            }
        };

        this.ws.onclose = () => {
            if (this.pingInterval) clearInterval(this.pingInterval);
            setTimeout(() => this.connect(), this.reconnectInterval);
            this.reconnectInterval = Math.min(this.reconnectInterval * 2, 30000);
        };

        this.ws.onerror = (err) => {
            console.error('❌ Global status WebSocket error:', err);
            this.ws?.close();
        };
    }

    public addMessageListener(listener: (event: MessageEvent) => void): void {
        this.messageListeners.push(listener);
    }
}

// ===========================================
// 👤 WebSocket для обновлений профиля
// ===========================================
class ProfileWebSocketManager {
    private ws: WebSocket | null = null;
    private currentChatId: number | null = null;
    private messageListeners: ((data: any) => void)[] = [];
    private reconnectInterval: number = 1000;

    connectToProfile(chatId: number): void {
        console.log(`🔴 ProfileWebSocketManager: connectToProfile called for chat ${chatId}`);
        
        if (this.currentChatId !== chatId && this.ws) {
            console.log(`🔴 Closing previous WebSocket for chat ${this.currentChatId}`);
            this.ws.close();
        }
    
        this.currentChatId = chatId;
        const token = authManager.getToken();
        
        if (!token) {
            console.error('❌ No auth token for profile WebSocket');
            setTimeout(() => this.connectToProfile(chatId), 5000);
            return;
        }
    
        const wsUrl = `wss://193.47.60.194:8080/ws/profile?chat_id=${chatId}&token=${encodeURIComponent(token)}`;
        console.log(`🔴 Connecting to profile WebSocket: ${wsUrl}`);
        this.ws = new WebSocket(wsUrl);
    
        this.ws.onopen = () => {
            console.log(`✅ Profile WebSocket connected for chat ${chatId}`);
            this.reconnectInterval = 1000;
        };
    
        this.ws.onmessage = (event: MessageEvent) => {
            console.log(`📨 RAW Profile WebSocket message for chat ${chatId}:`, event.data);
            try {
                const data = JSON.parse(event.data);
                console.log(`📨 PARSED Profile WebSocket message:`, data);
                
                this.messageListeners.forEach(listener => listener(data));
                
                if (data.type === 'profile_update' || data.type === 'profile:update') {
                    console.log('🔄 Profile update received:', data.content);
                    const customEvent = new CustomEvent('profileUpdated', { detail: data.content });
                    document.dispatchEvent(customEvent);
                }
                // 🔴 ДОБАВЬ ЭТОТ БЛОК ДЛЯ СТАТУСОВ
                else if (data.type === 'status_update' || data.type === 'user_status_update') {
                    console.log('🔄 Status update received in profile WS:', data);
                    const statusEvent = new CustomEvent('profileStatusUpdate', { 
                        detail: {
                            data: data.data || data.content,
                            chatId: chatId
                        }
                    });
                    document.dispatchEvent(statusEvent);
                }
                // 🔴 ДОБАВЬ ОБРАБОТКУ ОБНОВЛЕНИЙ ГРУППЫ
                else if (data.type === 'group_profile_update') {
                    console.log('🔄 Group profile update received:', data.content);
                    const groupEvent = new CustomEvent('groupProfileUpdate', { detail: data.content });
                    document.dispatchEvent(groupEvent);
                }
            } catch (error) {
                console.error('❌ Error parsing profile WebSocket message:', error, event.data);
            }
        };
    
        this.ws.onclose = (event) => {
            console.log(`🔴 Profile WebSocket closed for chat ${chatId}:`, event.code, event.reason);
            setTimeout(() => this.connectToProfile(chatId), this.reconnectInterval);
            this.reconnectInterval = Math.min(this.reconnectInterval * 2, 30000);
        };
    
        this.ws.onerror = (error) => {
            console.error(`❌ Profile WebSocket error for chat ${chatId}:`, error);
        };
    }

    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.currentChatId = null;
        }
    }

    addMessageListener(listener: (data: any) => void): void {
        this.messageListeners.push(listener);
    }

    removeMessageListener(listener: (data: any) => void): void {
        this.messageListeners = this.messageListeners.filter(l => l !== listener);
    }
}
export const statusSocket = new StatusSocket();
export const profileWebSocket = new ProfileWebSocketManager();

document.addEventListener('profileUpdated', ((e: CustomEvent<User | GroupProfile>) => {
}) as EventListener);