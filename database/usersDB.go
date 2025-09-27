package database

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"time"

	cloudModels "mess/models/cloudModels"
	usersModels "mess/models/usersModels"
)

func CheckPresenceUser(u usersModels.User) (bool, error) {
	var exists bool
	if err := DB.Get(&exists, "SELECT EXISTS(SELECT 1 FROM users WHERE email=$1 OR username=$2)", u.Email, u.UserName); err != nil {
		log.Println("failed to check presence user in db /database/usersDB")
		return false, err
	}
	return exists, nil
}

func GetUserPassword(u usersModels.UserLogin) (string, error) {
	var password string
	if err := DB.Get(&password, "SELECT password FROM users WHERE email=$1", u.Email); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", fmt.Errorf("user not found")
		}
		log.Println("failed to check presence user in db /database/usersDB")
		return password, err
	}
	return password, nil
}

func GetUserID(ul usersModels.UserLogin) (uint, error) {
	var id uint
	if err := DB.Get(&id, "SELECT id FROM users WHERE email=$1", ul.Email); err != nil {
		return 0, err
	}
	return id, nil
}

func GetUserNameByID(uid int) (string, error) {
	query := `SELECT u.name 
			FROM users u JOIN messages m ON m.user_id=u.id
			WHERE u.id=$1`
	var username string
	err := DB.Get(&username, query, uid)
	return username, err
}

func AddUser(u *usersModels.User) error {
	query := `INSERT INTO users (username,name,email,password)
				VALUES (:username,:name,:email,:password)`

	_, err := DB.NamedExec(query, u)
	if err != nil {
		log.Println("failed to add user into db /database/usersDB")
		return fmt.Errorf("failed to add user into db, error: %v", err.Error())
	}
	return nil
}

// for safasf
func UpdateAvatar(avatar cloudModels.Avatar) error {
	query := `UPDATE avatars SET is_current=false 
			WHERE owner_type=$1 AND owner_id=$2`
	_, err := DB.Exec(query, avatar.OwnerType, avatar.OwnerID)
	if err != nil {
		return err
	}

	query = `INSERT INTO avatars (url,owner_type,owner_id,is_current,created_at)
				VALUES (:url,:owner_type,:owner_id,:is_current,:created_at)`
	avatar.IsCurrent = true
	avatar.CreatedAt = time.Now()
	_, err = DB.NamedExec(query, avatar)
	return err
}
