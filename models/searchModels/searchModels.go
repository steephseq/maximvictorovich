package models

type SearchUser struct {
	ID       int    `json:"id" db:"id"`
	UserName string `json:"username" db:"username"`
	Phone    string `json:"phone" db:"phone"`
}

type SearchRequest struct {
	Query string `json:"query"`
}

type UsersIDSearch struct {
	Users []int `json:"users"`
}
