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
	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	query := `INSERT INTO users (email,name,password,username)
				VALUES ($1,$2,$3,$4)
				RETURNING id`
	if err := DB.QueryRow(query, u.Email, u.Name, u.Password, u.UserName).Scan(&u.ID); err != nil {
		log.Printf("failed to add user into db,error:%v", err)
		return err
	}

	if u.Avatar == "" {
		setDefaultUserAvatar(u)
	}

	query = `INSERT INTO avatars (url,is_group,owner_id,is_current)
			VALUES ($1,$2,$3,$4)`
	_, err = DB.Exec(query, u.Avatar, false, u.ID, true)
	if err != nil {
		log.Printf("u.avatar error (user_id=%d):%v", u.ID, err)
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	return nil
}

func setDefaultUserAvatar(u *usersModels.User) {
	u.Avatar = "https://i.pinimg.com/736x/a2/d0/5c/a2d05c22f5e18e15385ece62b92ae9c8.jpg"
}

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

func UpdateLastSeen(userID int, lastSeen time.Time) error {
	query := `UPDATE users SET last_seen=$1 WHERE id=$2`
	_, err := DB.Exec(query, lastSeen, userID)
	return err
}
