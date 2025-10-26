package profilemodels

import (
	usersModels "mess/models/usersModels"
)

type Profile struct {
	ID          int                `json:"id" db:"id"`
	Members     []usersModels.User `json:"members" db:"members"`
	CountMember int                `json:"count_members" db:"count_members"`
	Name        string             `json:"name" db:"name"`
	UserName    string             `json:"username" db:"username"`
	Bio         *string            `json:"bio" db:"bio"`
	AvatarURL   string             `json:"avatar_url" db:"url"`
	IsOnline    bool               `json:"is_online" db:"is_online"`
	IsGroup     bool               `json:"is_group" db:"is_group"`
}

type ProfileRequest struct {
	ID      int  `json:"id"`
	IsGroup bool `json:"is_group"`
}

type NewProfileParameter struct {
	OwnerID   int    `json:"id" db:"id"`
	IsGroup   bool   `json:"is_group"`
	Parameter string `json:"parameter"`
	Column    string `json:"column"`
	Action    string `json:"action"`
}
