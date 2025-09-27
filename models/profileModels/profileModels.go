package profilemodels

import (
	"database/sql"
	usersModels "mess/models/usersModels"
)

type GroupProfile struct {
	Members     []usersModels.User `json:"members" db:"members"`
	CountMember int                `json:"count_members" db:"count_members"`
	Name        string             `json:"name" db:"name"`
	AvatarURL   sql.NullString     `json:"url" db:"url"`
}
