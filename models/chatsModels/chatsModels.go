package models

import (
	"database/sql"
	usersModels "mess/models/usersModels"
	"time"

	"github.com/gorilla/websocket"
)

type Message struct {
	ID        int            `json:"id" db:"id"`
	ChatId    int            `json:"chat_id" db:"chat_id"`
	UserId    int            `json:"user_id" db:"user_id"`
	Name      string         `json:"name" db:"name"` //name msg author in chat
	Content   string         `json:"content" db:"content"`
	CreatedAt time.Time      `json:"created_at" db:"created_at"`
	URL       sql.NullString `json:"url" db:"url"`
	IsReady   bool           `json:"is_ready" db:"is_ready"`
	Type      string         `json:"type" db:"type"`
}

type Chat struct {
	ID          int            `json:"id" db:"id"`
	Name        *string        `json:"name" db:"name"`
	Is_group    bool           `json:"is_group" db:"is_group"`
	Updated_at  *time.Time     `json:"updated_at" db:"updated_at"`
	LastMessage *string        `json:"last_message" db:"last_message"`
	AvatarURL   *string        `json:"url" db:"url"`
	Bio         sql.NullString `json:"bio" db:"bio"`
}

type CreateChatRequest struct {
	ID         int       `json:"id" db:"id"`
	Name       string    `json:"name" db:"name"`
	Is_group   bool      `json:"is_group" db:"is_group"`
	Updated_at time.Time `json:"updated_at" db:"updated_at"`
	Users      []int     `json:"users"`
	Avatar     string    `json:"url" db:"url"`
}

type AddUsers struct {
	Users      []int                  `json:"users"`
	ChatID     int                    `json:"chat_id"`
	AdminRoots usersModels.AdminRoots `json:"admin"`
}

type Create121ChatRequest struct {
	Is_group bool `json:"is_group" db:"is_group"`
	User_ID  int  `json:"user_id"`
}
type Client struct {
	Conn   *websocket.Conn
	ChatID int
	UserID int `json:"user_id"`
}

type RemoveRequest struct {
	ChatID int   `json:"chat_id" db:"chat_id"`
	Users  []int `json:"users" db:"users"`
}

type ActionInChat struct {
	ChatID    int    `json:"chat_id" db:"chat_id"`
	UserID    int    `json:"user_id" db:"user_id"`
	MessageID int    `json:"message_id" db:"message_id"`
	Action    string `json:"action" db:"action"`
}

type AvaliableActionsMessage struct {
	CanDeleteMessage bool `json:"can_delete_message" db:"can_delete_message"`
	CanEditMessage   bool `json:"can_edit_message"`
}

type AvaliableActionsChat struct {
	CanDeleteMessage bool `json:"can_delete_message" db:"can_delete_message"`
	CanEditMessage   bool `json:"can_edit_message" db:"can_edit_message"`
	CanChangeAvatar  bool `json:"can_change_avatar" db:"can_change_avatar"`
}
