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
	err := DB.Get(&u, `SELECT 
		u.id,
		u.username,
		u.name,
		a.url
		FROM users u 
		LEFT JOIN avatars a ON a.owner_id=u.id
		WHERE u.username=$1 AND a.is_current=true`, userName)
	return u, err
}
