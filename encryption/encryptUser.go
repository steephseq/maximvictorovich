package encryption

import (
	"mess/database"
	usersModels "mess/models/usersModels"

	"golang.org/x/crypto/bcrypt"
)

func HashPasswordFunc(u *usersModels.User) (string, error) {
	hashPass, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashPass), nil
}

func CheckPasswordHash(ul usersModels.UserLogin) error {
	password, err := database.GetUserPassword(ul)
	if err != nil {
		return err
	}
	return bcrypt.CompareHashAndPassword([]byte(password), []byte(ul.Password))
}
