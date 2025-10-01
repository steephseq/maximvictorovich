package database

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	chatsModels "mess/models/chatsModels"
	profileModels "mess/models/profileModels"
	usersModels "mess/models/usersModels"
)

func GetUserProfile(uID int) (usersModels.User, error) {
	query := `SELECT
	u.id,
	u.name,
	u.username,
	u.bio,
	a.url
	FROM users u
	LEFT JOIN avatars a ON a.owner_id=u.id
	WHERE u.id=$1 AND a.is_current=true
			`
	var userProfile usersModels.User
	err := DB.Get(&userProfile, query, uID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			userProfile.Name = "Deleted Account"
			log.Println(userProfile, uID)
			return userProfile, nil
		}
	}
	return userProfile, err
}

func GetMyProfileHP(uid int) (usersModels.User, error) {
	query := `SELECT
			u.id, 
			u.name,
			a.url
			FROM users u
			JOIN avatars a ON a.owner_id=u.id
			WHERE u.id=$1 AND a.is_group=false AND a.is_current=true`

	var u usersModels.User
	err := DB.Get(&u, query, uid)
	return u, err
}

func GetGroupProfile(chatOBJ chatsModels.Chat) (profileModels.GroupProfile, error) {
	query := `SELECT
		c.name,
		c.bio,
		a.url
		FROM chats c
		LEFT JOIN avatars a ON a.owner_id=c.id 
		WHERE c.id=$1 AND a.is_current=true
		`
	var gp profileModels.GroupProfile

	if err := DB.QueryRow(query, chatOBJ.ID).Scan(&gp.Name, &gp.Bio, &gp.AvatarURL); err != nil {
		return gp, err
	}

	membersQuery := `SELECT
		u.id,
		u.name,
		a.url
		FROM chats c
		JOIN chats_users cu ON cu.chat_id=c.id 
		JOIN users u ON u.id=cu.user_id
		LEFT JOIN avatars a ON a.owner_id=u.id
		WHERE c.id=$1 and a.is_current=true
		ORDER BY u.id
	`

	rows, err := DB.Query(membersQuery, chatOBJ.ID)
	if err != nil {
		return gp, err
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var (
			user usersModels.User
		)

		if err := rows.Scan(&user.ID, &user.Name, &user.Avatar); err != nil {
			return gp, err
		}
		gp.Members = append(gp.Members, user)
		count += 1
	}
	if err := rows.Err(); err != nil {
		return gp, err
	}
	log.Println(gp)
	gp.CountMember = count
	return gp, nil
}

func SetXInfo(parameter profileModels.NewProfileParameter, column string) error {
	var tableName string
	if parameter.IsGroup {
		tableName = "chats"
	} else {
		tableName = "users"
	}

	switch column {
	case "bio":
		column = "bio"
	case "name":
		column = "name"
	case "username":
		column = "username"
	default:
		return fmt.Errorf("invalid column")
	}

	if column == "username" && parameter.IsGroup {
		return fmt.Errorf("groups havent username")
	}

	query := `UPDATE ` + tableName + ` SET ` + column + `=$1 WHERE id=$2`
	_, err := DB.Exec(query, parameter.Parameter, parameter.OwnerID)
	if err != nil {
		return err
	}
	return nil
}
