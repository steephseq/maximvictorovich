package database

import (
	usersModels "mess/models/usersModels"
)

func SearchByID(userID int) (usersModels.User, error) {
	var u usersModels.User
	err := DB.Get(&u, "SELECT id,username,name FROM users WHERE id=$1", userID)
	return u, err
}

func SearchByUserName(userName string) (usersModels.User, error) {
	var u usersModels.User
	err := DB.Get(&u, "SELECT id,username,name FROM users WHERE username=$1", userName)
	return u, err
}
