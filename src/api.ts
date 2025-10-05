import { authManager } from './auth.js';
import type { 
    Chat, 
    User, 
    GroupProfile, 
    LoginRequest, 
    RegisterRequest,
    Message
} from './types.js';

export class ProfileAPI {
    private baseURL = 'https://localhost:8080';

    private getAuthHeaders(): { [key: string]: string } {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token');
        }
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    async canEditProfile(ownerId: number, isGroup: boolean): Promise<boolean> {
        try {
            if (!isGroup) {
                const currentUser = await this.getProfile();
                return currentUser.id === ownerId;
            } else {
                const chats = await this.getChats();
                const chat = chats.find(c => c.id === ownerId);
                return chat?.is_admin === true;
            }
        } catch (error) {
            console.error('Error checking edit permissions:', error);
            return false;
        }
    }

    private async fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        if (!authManager.isTokenValid()) {
            authManager.logout();
            throw new Error('Токен истек');
        }

        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders(),
                    ...options.headers,
                },
                ...options
            });

            if (response.status === 401) {
                authManager.logout();
                throw new Error('Неавторизован');
            }

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.Message || result.message || `HTTP error! status: ${response.status}`);
            }

            if (result.Data !== undefined) {
                return result.Data as T;
            } else if (result.data !== undefined) {
                return result.data as T;
            } else {
                return result as T;
            }

        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    }

    async login(credentials: LoginRequest): Promise<string> {
        const response = await fetch(`${this.baseURL}/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(credentials)
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.Message || result.message || `HTTP error! status: ${response.status}`);
        }

        if (result.Data?.token) {
            return result.Data.token;
        } else if (result.data?.token) {
            return result.data.token;
        } else if (result.token) {
            return result.token;
        } else {
            throw new Error('Token not found in response');
        }
    }

    async register(userData: RegisterRequest): Promise<void> {
        const response = await fetch(`${this.baseURL}/register`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.Message || result.message || `HTTP error! status: ${response.status}`);
        }
    }

    async getProfile(): Promise<User> {
        const response = await fetch(`${this.baseURL}/myProfileHP`, {
            headers: this.getAuthHeaders()
        });

        const result = await response.json();
        
        if (response.status === 401) {
            throw new Error('Authentication failed');
        }
        
        if (!response.ok) {
            throw new Error(result.Message || result.message || `HTTP error! status: ${response.status}`);
        }

        return result.Data || result.data || result;
    }

    async fetchProfile(chatData: Chat): Promise<GroupProfile | User> {
        return this.fetchWithAuth<GroupProfile | User>('/profile', {
            method: 'POST',
            body: JSON.stringify(chatData)
        });
    }

    async getChats(): Promise<Chat[]> {
        const response = await fetch(`${this.baseURL}/chats`, {
            headers: this.getAuthHeaders()
        });

        const result = await response.json();
        
        if (response.status === 401) {
            throw new Error('Authentication failed');
        }
        
        if (!response.ok) {
            throw new Error(result.Message || result.message || `HTTP error! status: ${response.status}`);
        }

        return result.Data || result.data || result || [];
    }

    async getMessages(chatId: number): Promise<Message[]> {
        const numericChatId = Number(chatId);
        if (isNaN(numericChatId)) {
            throw new Error(`Invalid chat ID: ${chatId}`);
        }

        const response = await fetch(`${this.baseURL}/messages?id=${numericChatId}`, {
            headers: this.getAuthHeaders()
        });

        const result = await response.json();
        
        if (response.status === 401) {
            throw new Error('Authentication failed');
        }
        
        if (!response.ok) {
            throw new Error(result.Message || result.message || `HTTP error! status: ${response.status}`);
        }

        return result.Data || result.data || result || [];
    }

    async setBio(ownerId: number, isGroup: boolean, bio: string): Promise<void> {
        return this.setProfileParameter({
            id: ownerId,
            is_group: Boolean(isGroup),
            parameter: bio,
            column: 'bio',
            action: 'can_change_bio'
        });
    }

    async setName(ownerId: number, isGroup: boolean, name: string): Promise<void> {
        return this.setProfileParameter({
            id: ownerId,
            is_group: Boolean(isGroup),
            parameter: name,
            column: 'name',
            action: 'can_change_name'
        });
    }

    async setUsername(ownerId: number, username: string): Promise<void> {
        return this.setProfileParameter({
            id: ownerId,
            is_group: false,
            parameter: username,
            column: 'username',
            action: 'can_change_name'
        });
    }

    private async setProfileParameter(parameter: any): Promise<void> {
        let endpoint = '';
        
        switch (parameter.column) {
            case 'bio':
                endpoint = '/setBio';
                break;
            case 'name':
                endpoint = '/setName';
                break;
            case 'username':
                endpoint = '/setUserName';
                break;
            default:
                throw new Error(`Unknown parameter: ${parameter.column}`);
        }

        await this.fetchWithAuth<any>(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(parameter)
        });
    }   

    async searchUsers(query: string): Promise<User[]> {
        try {
            const result = await this.fetchWithAuth<User | User[]>('/searchUser', {
                method: 'POST',
                body: JSON.stringify({ query })
            });

            if (Array.isArray(result)) {
                return result;
            } else if (result) {
                return [result];
            }
            return [];
        } catch (error) {
            console.error('Search users error:', error);
            return [];
        }
    }

    async universalSearch(query: string, chats: Chat[]): Promise<{ users: User[], chats: Chat[] }> {
        try {
            const [users, filteredChats] = await Promise.all([
                this.searchUsers(query),
                this.searchChats(query, chats)
            ]);

            return { users, chats: filteredChats };
        } catch (error) {
            console.error('Universal search error:', error);
            return { users: [], chats: [] };
        }
    }

    private async searchChats(query: string, allChats: Chat[]): Promise<Chat[]> {
        const searchTerm = query.toLowerCase().trim();
        
        if (!allChats || allChats.length === 0) {
            return [];
        }
        
        return allChats.filter(chat => 
            chat.name && chat.name.toLowerCase().includes(searchTerm)
        );
    }

    async addUsersToChat(chatId: number, userIds: number[]): Promise<{added: number[], alreadyExists: number[]}> {
        return this.fetchWithAuth<{added: number[], alreadyExists: number[]}>('/addUsers', {
            method: 'POST',
            body: JSON.stringify({ 
                chat_id: chatId,
                users: userIds 
            })
        });
    }

    async removeUserFromChat(chatId: number, userIds: number[]): Promise<number[]> {
        return this.fetchWithAuth<number[]>('/removeUserFromChat', {
            method: 'POST',
            body: JSON.stringify({
                chat_id: chatId,
                users: userIds
            })
        });
    }

    async createChat(name: string, isGroup: boolean = false): Promise<Chat> {
        return this.fetchWithAuth<Chat>('/createChat', {
            method: 'POST',
            body: JSON.stringify({
                name,
                is_group: isGroup
            })
        });
    }

    async createEmptyMessage(chatId: number, messageType: string): Promise<number> {
        const response = await this.fetchWithAuth<any>('/createEmptyMessage', {
            method: 'POST',
            body: JSON.stringify({
                chat_id: chatId,
                type: messageType,
                is_ready: false
            })
        });

        if (typeof response === 'number') {
            return response;
        } else if (response?.id) {
            return response.id;
        } else if (response?.message_id) {
            return response.message_id;
        } else {
            throw new Error('Message ID not found in response');
        }
    }

    async uploadFile(file: File, messageId?: number): Promise<string> {
        const formData = new FormData();
        formData.append('file', file);
        
        if (messageId) {
            formData.append('message_id', messageId.toString());
        }

        const response = await fetch(`${this.baseURL}/uploadFile`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.Data?.filename) {
            return result.Data.filename;
        } else if (result.data?.filename) {
            return result.data.filename;
        } else if (result.filename) {
            return result.filename;
        } else if (result.Data?.url) {
            return result.Data.url;
        } else if (result.data?.url) {
            return result.data.url;
        } else if (result.url) {
            return result.url;
        } else {
            throw new Error('File URL not found in response');
        }
    }

    validateFileSize(file: File, maxSizeMB: number = 1024): boolean {
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        return file.size <= maxSizeBytes;
    }

    getFileType(file: File): string {
        if (file.type.startsWith('image/')) return 'image';
        if (file.type.startsWith('video/')) return 'video';
        if (file.type.startsWith('audio/')) return 'audio';
        if (file.type === 'application/pdf') return 'pdf';
        if (file.type.includes('document') || file.type.includes('word')) return 'document';
        if (file.type.includes('sheet') || file.type.includes('excel')) return 'spreadsheet';
        return 'file';
    }

    async create121Chat(userId: number): Promise<Chat> {
        const existingChatId = await this.checkChatExists(userId);
        
        if (existingChatId) {
            return await this.getChatById(existingChatId);
        } else {
            const response = await this.fetchWithAuth<any>('/create121Chat', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: userId
                })
            });

            return this.normalizeChat(response);
        }
    }

    private async getUserInfo(userId: number): Promise<User> {
        try {
            const users = await this.searchUsers('');
            const user = users.find(u => u.id === userId);
            
            if (user) {
                return user;
            }
            
            return {
                id: userId,
                name: 'Пользователь',
                username: 'user',
                email: '',
                avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face'
            };
            
        } catch (error) {
            console.error('Error getting user info:', error);
            return {
                id: userId,
                name: 'Пользователь',
                username: 'user',
                email: '',
                avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face'
            };
        }
    }

    async checkChatExists(userId: number): Promise<number | null> {
        try {
            const response = await this.fetchWithAuth<any>('/chatExists', {
                method: 'POST',
                body: JSON.stringify({ user_id: userId })
            });
            
            if (response && response.chat_id) {
                return response.chat_id;
            }
            
            if (typeof response === 'number') {
                return response;
            }
            
            if (response && response.Data !== undefined) {
                return response.Data;
            }
            
            return null;
            
        } catch (error: any) {
            if (error.message?.includes('404') || error.message?.includes('not found') || error.message?.includes('not exists')) {
                return null;
            }
            
            console.error('Error checking chat existence:', error);
            return null;
        }
    }

    async getChatById(chatId: number): Promise<Chat> {
        const chats = await this.getChats();
        const chat = chats.find(c => c.id === chatId);
        
        if (!chat) {
            throw new Error(`Chat with id ${chatId} not found`);
        }
        
        return chat;
    }

    async createGroup(name: string, userIds: number[] = []): Promise<Chat> {
        const response = await this.fetchWithAuth<any>('/createChat', {
            method: 'POST',
            body: JSON.stringify({
                name: name,
                is_group: true,
                users: userIds
            })
        });

        if (response && response.id) {
            return this.normalizeChat(response);
        } else {
            throw new Error('Не удалось получить созданный чат');
        }
    }

    private normalizeChat(chatData: any): Chat {
        const normalizedChat: Chat = {
            id: chatData.id || chatData.chat_id,
            name: chatData.name || 'Без имени',
            is_group: chatData.is_group || false,
            isGroup: chatData.is_group || false,
            avatar_url: chatData.avatar_url || chatData.avatar || chatData.url,
            avatar: chatData.avatar_url || chatData.avatar || chatData.url,
            url: chatData.avatar_url || chatData.avatar || chatData.url,
            last_message: chatData.last_message || chatData.lastMessage || 'Нет сообщений',
            lastMessage: chatData.last_message || chatData.lastMessage || 'Нет сообщений',
            last_message_time: chatData.last_message_time || chatData.lastMessageTime || new Date().toISOString(),
            lastMessageTime: chatData.last_message_time || chatData.lastMessageTime || new Date().toISOString(),
            unread_count: chatData.unread_count || chatData.unreadCount || 0,
            unreadCount: chatData.unread_count || chatData.unreadCount || 0,
            count_members: chatData.count_members || 1,
            is_admin: chatData.is_admin !== undefined ? chatData.is_admin : true,
            created_at: chatData.created_at || new Date().toISOString(),
            updated_at: chatData.updated_at || new Date().toISOString()
        };

        return normalizedChat;
    }

    async deleteMessage(messageId: number): Promise<void> {
        return this.fetchWithAuth<void>('/deleteMessage', {
            method: 'POST',
            body: JSON.stringify({
                message_id: messageId
            })
        });
    }

    async setAvatar(formData: FormData): Promise<void> {
        const response = await fetch(`${this.baseURL}/setAvatar`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error('Failed to set avatar');
        }
    }

    async getGroupProfile(chatId: number): Promise<any> {
        return this.getChatProfile(chatId, true);
    }

    async getUserProfileByChatId(chatId: number): Promise<any> {
        return this.getChatProfile(chatId, false);
    }

    async getChatProfile(chatId: number, isGroup: boolean): Promise<any> {
        const response = await fetch('/profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                id: chatId,
                is_group: isGroup
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.code === 200 && data.data) {
            return {
                ...data.data,
                is_group: isGroup
            };
        } else {
            throw new Error(data.message || 'Failed to get profile');
        }
    }
}