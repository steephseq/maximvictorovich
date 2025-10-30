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

func GetUserProfile(uID int) (profileModels.Profile, error) {
	query := `SELECT
	u.id,
	u.name,
	u.username,
	u.bio,
	a.url
	FROM users u
	JOIN avatars a ON a.owner_id=u.id
	WHERE u.id=$1 AND a.is_current=true
	`
	var profile profileModels.Profile
	err := DB.Get(&profile, query, uID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			profile.Name = "Deleted Account"
			log.Println(profile, uID)
			return profile, nil
		}
	}
	profile.Members = append(profile.Members, usersModels.User{ID: uint(profile.ID)})
	return profile, err
}

func UserLastSeen(uID int) (string, error) {
	query := `SELECT
		last_seen
	FROM users 
	WHERE id=$1`
	var lastSeen string
	err := DB.QueryRow(query, uID).Scan(&lastSeen)
	return lastSeen, err
}

func GetMyProfileHP(uid int) (profileModels.Profile, error) {
	query := `SELECT
			u.id,
			u.name,
			u.username,
			u.bio,
			a.url
			FROM users u
			JOIN avatars a ON a.owner_id=u.id
			WHERE u.id=$1 AND a.is_group=false AND a.is_current=true`

	var profile profileModels.Profile
	err := DB.Get(&profile, query, uid)
	return profile, err
}

func GetGroupProfile(chat chatsModels.Chat) (profileModels.Profile, error) {
	query := `SELECT
		c.name,
		c.bio,
		a.url
		FROM chats c
		JOIN avatars a ON a.owner_id=c.id
		WHERE c.id=$1 AND a.is_current=true
		`
	var gp profileModels.Profile

	if err := DB.QueryRow(query, chat.ID).Scan(&gp.Name, &gp.Bio, &gp.AvatarURL); err != nil {
		return gp, err
	}

	membersQuery := `SELECT
		u.id,
		u.name,
		u.username,
		cr.title,
		a.url
		FROM chats c
		JOIN chats_users cu ON cu.chat_id=c.id
		JOIN users u ON u.id=cu.user_id
		JOIN avatars a ON a.owner_id=u.id AND a.is_group=false
		LEFT JOIN chats_roles cr ON cr.user_id=u.id AND cr.chat_id=c.id
		WHERE c.id=$1 and a.is_current=true
		ORDER BY u.id
	`

	rows, err := DB.Query(membersQuery, chat.ID)
	if err != nil {
		return gp, err
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var (
			user  usersModels.User
			title sql.NullString
		)

		if err := rows.Scan(&user.ID, &user.Name, &user.UserName, &title, &user.Avatar); err != nil {
			return gp, err
		}
		log.Printf("✅ AdminTitle: %s", title.String)
		if title.Valid {
			user.AdminTitle = title.String
		} else {
			user.AdminTitle = ""
		}
		gp.Members = append(gp.Members, user)
		count += 1
	}
	if err := rows.Err(); err != nil {
		return gp, err
	}
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

func GetGroupActions(userID int, chatID int) ([]string, error) {
	query := `SELECT
		cr.can_delete_users,
		cr.can_change_bio,
		cr.can_change_name,
		cr.can_change_avatar,
		cr.can_manage_roles
		FROM chats_roles cr
		WHERE cr.user_id=$1 AND cr.chat_id=$2`
	var actions []string
	err := DB.Select(&actions, query, userID, chatID)
	return actions, err
}
