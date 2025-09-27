package models

import "database/sql"

type User struct {
	ID       uint           `json:"id" db:"id"`
	UserName string         `json:"username" db:"username"`
	Name     string         `json:"name" db:"name"`
	Email    string         `json:"email" db:"email"`
	Password string         `json:"password" db:"password"`
	Bio      sql.NullString `json:"bio" db:"bio"`
}

type UserLogin struct {
	Email    string `json:"email" db:"email"`
	Password string `json:"password" db:"password"`
}

type AdminRoots struct {
	UserID            int            `json:"user_id" db:"user_id"`
	ChatID            int            `json:"chat_id" db:"chat_id"`
	Title             sql.NullString `json:"title" db:"title"`
	CanDeleteMessages bool           `json:"can_delete_messages" db:"can_delete_messages"`
	CanBanUsers       bool           `json:"can_ban_users" db:"can_ban_users"`
	CanEditChatInfo   bool           `json:"can_edit_chat_info" db:"can_edit_chat_info"`
	CanManageRoles    bool           `json:"can_manage_roles" db:"can_manage_roles"`
	CanChangeAvatar   bool           `json:"can_change_avatar" db:"can_change_avatar"`
}
