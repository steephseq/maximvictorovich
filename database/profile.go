package database

import (
	"database/sql"
	"errors"
	"fmt"
	chatsModels "mess/models/chatsModels"
	profileModels "mess/models/profileModels"
	usersModels "mess/models/usersModels"
)

func GetUserProfile(uID int) (usersModels.User, error) {
	query := `SELECT
	name , username, bio 
	FROM users
	WHERE id=$1
			`
	var userProfile usersModels.User
	err := DB.Get(&userProfile, query, uID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return userProfile, fmt.Errorf("user not found")
		}
	}
	return userProfile, err
}

func IsMyProfile(uid int) (bool, error) {
	query := `SELECT EXISTS
			(SELECT 1 FROM users WHERE id=$1)`
	var exists bool
	err := DB.Get(exists, query, uid)
	return exists, err
}

func GetGroupProfile(chatOBJ chatsModels.Chat) (profileModels.GroupProfile, error) {
	query := `SELECT
		COUNT(cu.user_id)  OVER() AS count_members,
		u.id,
		u.name,
		c.name,
		a.url
		FROM chats c
		JOIN chats_users cu ON cu.chat_id=c.id 
		JOIN users u ON u.id=cu.user_id
		LEFT JOIN avatars a ON a.owner_id=c.id
		WHERE c.id=$1;
		`

	var gp profileModels.GroupProfile
	rows, err := DB.Query(query, chatOBJ.ID)
	if err != nil {
		return gp, err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			count     int
			user      usersModels.User
			avatarURL sql.NullString
		)

		if err := rows.Scan(&count, &user.ID, &user.Name, &gp.Name, &gp.AvatarURL); err != nil {
			return gp, err
		}

		if avatarURL.Valid {
			gp.AvatarURL = avatarURL
		}

		gp.Members = append(gp.Members, user)
		gp.CountMember = count

	}
	if err := rows.Err(); err != nil {
		return gp, err
	}
	return gp, nil
}
