package profilemodels

import (
	"database/sql"
	usersModels "mess/models/usersModels"
)

type GroupProfile struct {
	Members     []usersModels.User `json:"members" db:"members"`
	CountMember int                `json:"count_members" db:"count_members"`
	Name        string             `json:"name" db:"name"`
	Bio         sql.NullString     `json:"bio" db:"bio"`
	AvatarURL   string             `json:"avatar_url" db:"url"`
}

type NewProfileParameter struct {
	OwnerID   int    `json:"id" db:"id"`
	IsGroup   bool   `json:"is_group"`
	Parameter string `json:"parameter"`
	Column    string `json:"column"`
	Action    string `json:"action"`
}
