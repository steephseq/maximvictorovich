import { authManager } from './auth.js';
import type { 
    Chat, 
    User, 
    GroupProfile, 
    LoginRequest, 
    RegisterRequest,
    Message,
    AvailableMessageActions
} from './types.js';

export class ProfileAPI {
    private baseURL = 'https://193.47.60.194:8080';

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

    async updateProfile(ownerId: number, column: string, value: string, isGroup: boolean = false): Promise<any> {
        const token = localStorage.getItem('token');
        
        if (!token) {
            throw new Error('No authentication token found');
        }
    
        let endpoint = '';
        switch (column) {
            case 'name':
                endpoint = '/setName';
                break;
            case 'username':
                endpoint = '/setUserName';
                break;
            case 'bio':
                endpoint = '/setBio';
                break;
            default:
                throw new Error(`Unknown column: ${column}`);
        }
    
        // ПРАВИЛЬНЫЙ payload согласно вашему бекенду
        const payload = {
            id: ownerId,                    // ID владельца профиля
            is_group: isGroup,              // false для пользователя
            parameter: value,               // новое значение
            column: column,                 // имя поля
            action: `can_change_${column}`  // действие для проверки прав
        };
    
        console.log('📤 Updating profile:', { endpoint, payload });
    
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
    
            if (!response.ok) {
                let errorMessage = `HTTP error! status: ${response.status}`;
                
                try {
                    const errorResult = await response.json();
                    errorMessage = errorResult.message || errorMessage;
                } catch (e) {
                    // Если не удалось распарсить JSON, используем стандартное сообщение
                }
                
                throw new Error(errorMessage);
            }
    
            const result = await response.json();
            
            if (result.code !== 200) {
                throw new Error(result.message || 'Unknown error');
            }
    
            console.log('✅ Profile update successful:', result);
            return result;
    
        } catch (error) {
            console.error('❌ Profile update failed:', error);
            throw error;
        }
    }

    async updateName(userId: number, name: string): Promise<any> {
        return this.updateProfile(userId, 'name', name, false);
    }
    
    async updateUsername(userId: number, username: string): Promise<any> {
        return this.updateProfile(userId, 'username', username, false);
    }
    
    async updateBio(userId: number, bio: string): Promise<any> {
        return this.updateProfile(userId, 'bio', bio, false);
    }

    private async fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        console.log('🔍 fetchWithAuth called for endpoint:', endpoint);
        
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
    
            console.log('📡 Raw fetch response status:', response.status);
            console.log('📡 Raw fetch response headers:', response.headers);
    
            if (response.status === 401) {
                authManager.logout();
                throw new Error('Неавторизован');
            }
    
            const result = await response.json();
            console.log('📦 Parsed JSON result:', result);
            
            if (!response.ok) {
                throw new Error(result.Message || result.message || `HTTP error! status: ${response.status}`);
            }
    
            // ПРОБЛЕМА МОЖЕТ БЫТЬ ЗДЕСЬ - проверяем структуру ответа
            let finalData: T;
            
            if (result.Data !== undefined) {
                console.log('📋 Using result.Data');
                finalData = result.Data as T;
            } else if (result.data !== undefined) {
                console.log('📋 Using result.data');
                finalData = result.data as T;
            } else {
                console.log('📋 Using result directly');
                finalData = result as T;
            }
            
            console.log('🎯 Final data to return:', finalData);
            return finalData;
    
        } catch (error) {
            console.error('❌ Fetch error:', error);
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
        try {
            console.log('🔍 API: Starting getProfile request...');
            console.log('🔐 Token:', localStorage.getItem('token')?.substring(0, 20) + '...');
            
            const response = await this.fetchWithAuth<User>('/myProfileHP', {
                method: 'GET'
            });
            
            console.log('📥 Raw profile response:', response);
            console.log('👤 Profile ID:', response?.id);
            console.log('👤 Profile data type:', typeof response?.id);
            
            // Проверяем структуру ответа
            if (response && response.id === 0) {
                console.warn('⚠️ WARNING: API returned user ID = 0');
                console.warn('📋 Full response structure:', JSON.stringify(response, null, 2));
            }
            
            return response;
        } catch (error) {
            console.error('❌ API getProfile error:', error);
            throw error;
        }
    }
    async fetchProfile(chatData: Chat): Promise<GroupProfile | User> {
        console.log("📡 Запрос профиля для:", chatData);
        const result = await this.fetchWithAuth<GroupProfile | User>('/profile', {
            method: 'POST',
            body: JSON.stringify({
                id: chatData.id,
                is_group: chatData.is_group
            })
        });
        console.log("📥 Ответ профиля:", result);
        return result;
    }
    
    async editMessage(messageId: number, newContent: string, userId: number, chatId: number): Promise<void> {
        return this.fetchWithAuth<void>('/editMessage', {
            method: 'PATCH',
            body: JSON.stringify({
                id: messageId,           // ← меняем message_id на id
                content: newContent,
                user_id: userId,         // ← user_id
                chat_id: chatId,         // ← chat_id  
                is_ready: true           // ← is_ready
            })
        });
    }
    
    
    async deleteMessage(messageId: number, chatId: number): Promise<void> {
        return this.fetchWithAuth<void>('/deleteMessage', {
            method: 'POST',
            body: JSON.stringify({
                message_id: messageId,
                chat_id: chatId,
                action: "can_delete_messages" // ← ИЗМЕНИТЕ "delete" НА "can_delete_messages"
            })
        });
    }

    async getChats(offset: number = 0): Promise<Chat[]> {
        return this.fetchWithAuth<Chat[]>(`/chats?offset=${offset}`, {
            method: 'GET'
        });
    }

    async getMessages(chatId: number): Promise<Message[]> {
        const numericChatId = Number(chatId);
        if (isNaN(numericChatId)) {
            throw new Error(`Неверный ID чата: ${chatId}`);
        }

        console.log(`📨 Запрос сообщений для чата: ${numericChatId}`);

        try {
            const messages = await this.fetchWithAuth<Message[]>(`/messages?id=${numericChatId}`, {
                method: 'GET'
            });

            console.log(`📨 Получено сообщений: ${messages?.length || 0}`);
            
            // 🔴 ЛОГИРОВАНИЕ СТРУКТУРЫ СООБЩЕНИЙ
            if (messages && messages.length > 0) {
                messages.forEach((msg, index) => {
                    console.log(`📊 Сообщение ${index + 1}:`, {
                        id: msg.id,
                        type: msg.type,
                        content_type: typeof msg.content,
                        content_preview: String(msg.content).substring(0, 100),
                        filename: msg.filename,
                        is_ready: msg.is_ready
                    });
                });
            }

            return messages || [];

        } catch (error) {
            console.error('❌ Ошибка получения сообщений:', error);
            throw error;
        }
    }

    

    async setBio(ownerId: number, isGroup: boolean, bio: string): Promise<void> {
        return this.setProfileParameter({
            id: ownerId,
            is_group: Boolean(isGroup),
            parameter: bio,
            column: 'bio'
        });
    }

    async setName(ownerId: number, isGroup: boolean, name: string): Promise<void> {
        return this.setProfileParameter({
            id: ownerId,
            is_group: Boolean(isGroup),
            parameter: name,
            column: 'name'
        });
    }

    async setUsername(ownerId: number, username: string): Promise<void> {
        return this.setProfileParameter({
            id: ownerId,
            is_group: false,
            parameter: username,
            column: 'username'
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
            method: 'POST',
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
                return result.map(user => ({
                    ...user,
                    is_online: user.is_online !== undefined ? user.is_online : false
                }));
            } else if (result) {
                return [{
                    ...result,
                    is_online: result.is_online !== undefined ? result.is_online : false
                }];
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

    async removeUserFromChat(chatId: number, userId: number): Promise<void> {
        console.log('📡 API: removeUserFromChat вызван с:', { 
            chatId, 
            userId,
            chatIdType: typeof chatId,
            userIdType: typeof userId
        });
        
        // Согласно вашему бекенду - используется DELETE с query параметрами
        const url = `/removeUserFromChat?chat_id=${chatId}&user_id=${userId}`;
        console.log('🔗 URL запроса:', url);
        
        return this.fetchWithAuth<void>(url, {
            method: 'DELETE'
        });
    }

    async getAvailableUserActions(chatId: number): Promise<{
        CanDeleteUser: boolean;
        CanBanUser: boolean;
        CanManageRoles: boolean;
    }> {
        console.log('📡 API: getAvailableUserActions вызван с chatId:', chatId);
        
        // Согласно вашему бекенду - GET запрос с query параметром
        return this.fetchWithAuth<any>(`/howCanIDoUser?chat_id=${chatId}`, {
            method: 'GET'
        });
    }

    async getAvailableMessageActions(chatId: number, messageId: number): Promise<AvailableMessageActions> {
        console.log('📡 API: getAvailableMessageActions вызван с:', { chatId, messageId });
        
        return this.fetchWithAuth<any>(`/howCanIDoMessage?id=${chatId}&mid=${messageId}`, {
            method: 'GET'
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
        console.log(`📝 Создание пустого сообщения для чата ${chatId}, тип: ${messageType}`);
    
        try {
            const response = await this.fetchWithAuth<any>('/createEmptyMessage', {
                method: 'POST',
                body: JSON.stringify({
                    chat_id: chatId,
                    type: messageType,
                    is_ready: false
                })
            });
    
            console.log('📝 Ответ создания сообщения:', response);
    
            // Извлекаем ID сообщения
            let messageId: number | undefined;
    
            if (typeof response === 'number') {
                messageId = response;
            } else if (response?.id) {
                messageId = response.id;
            } else if (response?.message_id) {
                messageId = response.message_id;
            } else if (response?.Data?.id) {
                messageId = response.Data.id;
            } else if (response?.data?.id) {
                messageId = response.data.id;
            }
    
            if (messageId === undefined) {
                console.error('❌ ID сообщения не найден в ответе:', response);
                throw new Error('Не удалось получить ID созданного сообщения');
            }
    
            console.log(`✅ Создано сообщение с ID: ${messageId}`);
            return messageId;
    
        } catch (error) {
            console.error('❌ Ошибка создания пустого сообщения:', error);
            throw error;
        }
    }

    // В api.ts - исправленный метод updateMessageWithFile
    async updateMessageWithFile(
        messageId: number, 
        fileUrl: string, 
        fileType: string, 
        userId: number, 
        chatId: number,
        duration?: number // 🔴 ДОБАВЛЯЕМ ДЛИТЕЛЬНОСТЬ
    ): Promise<void> {
        try {
            console.log(`🔄 Обновление сообщения ${messageId} с файлом: ${fileUrl}, тип: ${fileType}, длительность: ${duration}с`);
            
            if (!userId) {
                throw new Error('Пользователь не авторизован');
            }
    
            // Создаем payload с поддержкой длительности
            const payload: any = {
                id: messageId,
                content: fileUrl,
                user_id: userId,
                chat_id: chatId,
                is_ready: true
            };

            // Добавляем длительность для голосовых сообщений
            if (fileType === 'voice' && duration) {
                payload.duration = duration;
            }
    
            await this.fetchWithAuth<void>('/editMessage', {
                method: 'PATCH',
                body: JSON.stringify(payload)
            });
            
            console.log(`✅ Сообщение ${messageId} успешно обновлено`);
        } catch (error) {
            console.error(`❌ Ошибка обновления сообщения ${messageId}:`, error);
            throw error;
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
        if (file.type.startsWith('application/')) return 'document';
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
                return {
                    ...user,
                    is_online: user.is_online !== undefined ? user.is_online : false
                };
            }
            
            return {
                id: userId,
                name: 'Пользователь',
                username: 'user',
                email: '',
                avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
                is_online: false
            };
            
        } catch (error) {
            console.error('Error getting user info:', error);
            return {
                id: userId,
                name: 'Пользователь',
                username: 'user',
                email: '',
                avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
                is_online: false
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

    async setAvatar(file: File, ownerId: number, isGroup: boolean = false): Promise<string> {
        const formData = new FormData();
        formData.append('avatar', file);
        formData.append('owner_id', ownerId.toString());
        formData.append('is_group', isGroup.toString());
    
        const response = await fetch(`${this.baseURL}/setAvatar`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });
    
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Avatar upload error:', errorText);
            throw new Error(`Failed to upload avatar: ${response.status}`);
        }
    
        const result = await response.json();
        console.log('Avatar upload response:', result);
    
        // Бэкенд возвращает полный URL аватарки
        if (result.Data?.url) {
            return result.Data.url;
        } else if (result.data?.url) {
            return result.data.url;
        } else if (result.url) {
            return result.url;
        } else {
            throw new Error('Avatar URL not found in response');
        }
    }

    async updateProfileField(userId: number, field: string, value: string): Promise<void> {
        const endpoint = field === 'bio' ? '/setBio' : 
                        field === 'name' ? '/setName' : 
                        '/setUserName';
        
        await this.fetchWithAuth<any>(endpoint, {
            method: 'POST',
            body: JSON.stringify({
                id: userId,
                is_group: false,
                parameter: value,
                column: field
            })
        });
    }
}