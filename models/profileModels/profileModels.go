package profilemodels

import (
	usersModels "mess/models/usersModels"
)

type GroupProfile struct {
	Members     []usersModels.User `json:"members" db:"members"`
	CountMember int                `json:"count_members" db:"count_members"`
	Name        string             `json:"name" db:"name"`
}
