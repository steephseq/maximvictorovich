// Базовые интерфейсы
export interface User {
    id: number;
    name: string;
    username: string;
    email: string;
    bio?: string;
    avatar_url?: string;
    avatar?: string;
    url?: string;
    online?: boolean;
    created_at?: string;
}

export interface Chat {
    id: number;
    name: string;
    is_group: boolean;
    isGroup?: boolean;
    avatar_url?: string;
    avatar?: string;
    last_message?: string;
    lastMessage?: string;
    last_message_time?: string;
    lastMessageTime?: string;
    unread_count?: number;
    unreadCount?: number;
    updated_at?: string;
    url?: string;
    online?: boolean;
    count_members?: number;
    created_at?: string;
    is_admin?: boolean;
}

export interface FileUploadResponse {
    url: string;
}

export interface UploadedFile {
    id?: string;
    name: string;
    url: string;
    size: number;
    type: string;
    uploadedAt: string;
}

export interface Message {
    id: number;
    chat_id: number;
    user_id: number;
    name: string;
    content: string;
    created_at: string;
    updated_at?: string;
    is_edited?: boolean;
    is_deleted?: boolean;
    is_ready?: boolean;
    type?: string;
    attachments?: UploadedFile[];
    thumbnail_url?: string;
    url?: string;
    filename?: string; // Thumbnail filename from DB
}

export interface GroupProfile {
    id: number;
    name: string;
    bio?: string;
    avatar_url?: string;
    avatar?: string;
    count_members: number;
    members: User[];
    created_at?: string;
    is_admin?: boolean;
}

// Запросы
export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    name: string;
    username: string;
    email: string;
    password: string;
}

export interface SendMessageRequest {
    chat_id: number;
    content: string;
    user_id?: number;
}

export interface SearchRequest {
    query: string;
}

export interface AddUsersRequest {
    chat_id: number;
    users: number[];
}

export interface RemoveUserRequest {
    chat_id: number;
    users: number[];
}

export interface CreateChatRequest {
    name: string;
    is_group: boolean;
    users?: number[];
}

export interface Create121ChatRequest {
    user_id: number;
}

export interface DeleteMessageRequest {
    message_id: number;
}

// Ответы API
export interface ApiResponse<T = any> {
    Code: number;
    Message: string;
    Data?: T;
    // Альтернативные варианты названий полей
    code?: number;
    message?: string; 
    data?: T;
}

export interface LoginResponse {
    Code: number;
    Message: string;
    Data: {
        token: string;
        user?: User;
    };
    // Альтернативные варианты
    token?: string;
    data?: {
        token: string;
        user?: User;
    };
}

export interface RegisterResponse {
    Code: number;
    Message: string;
    Data?: {
        user_id?: number | null;
        user?: User;
    };
}

export interface ChatsResponse {
    Code: number;
    Message: string;
    Data: Chat[];
}

export interface MessagesResponse {
    Code: number;
    Message: string;
    Data: Message[];
}

export interface ProfileResponse {
    Code: number;
    Message: string;
    Data: User | GroupProfile;
}

export interface SearchResponse {
    Code: number;
    Message: string;
    Data: User | User[];
}

export interface AddUsersResponse {
    Code: number;
    Message: string;
    Data: {
        added: number[];
        alreadyExists: number[];
    };
}

export interface RemoveUserResponse {
    Code: number;
    Message: string;
    Data: number[];
}

export interface CreateChatResponse {
    Code: number;
    Message: string;
    Data: Chat;
}

export interface DeleteMessageResponse {
    Code: number;
    Message: string;
    Data?: null;
}

// WebSocket сообщения
export interface WebSocketMessage {
    type: 'message' | 'typing' | 'read_receipt' | 'user_joined' | 'user_left';
    data: any;
}

export interface TypingIndicator {
    chat_id: number;
    user_id: number;
    user_name: string;
    is_typing: boolean;
}

export interface ReadReceipt {
    chat_id: number;
    user_id: number;
    message_id: number;
    read_at: string;
}

// Состояния приложения
export interface AppState {
    currentUser: User | null;
    currentChat: Chat | null;
    chats: Chat[];
    messages: Message[];
    isConnected: boolean;
    isLoading: boolean;
}

// Пейджинг
export interface PaginationParams {
    page: number;
    limit: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    has_more: boolean;
}

export interface SearchResult {
    users?: User[];
    chats?: Chat[];
    messages?: Message[];
}

export interface UniversalSearchResponse {
    Code: number;
    Message: string;
    Data: SearchResult;
}

// Интерфейсы для компонентов поиска
export interface SearchState {
    query: string;
    type: 'users' | 'chats' | 'messages';
    results: SearchResult;
    isLoading: boolean;
    isOpen: boolean;
}


// Добавляем в существующие типы

export interface CreateGroupRequest {
    name: string;
    is_group: boolean;
    users?: number[];
}

export interface CreateGroupResponse {
    Code: number;
    Message: string;
    Data?: {
        chat_id?: number;
        chat?: Chat;
    };
}

export interface AddUsersRequest {
    chat_id: number;
    users: number[];
}

export interface AddUsersResponse {
    Code: number;
    Message: string;
    Data: {
        added: number[];
        alreadyExists: number[];
    };
}

