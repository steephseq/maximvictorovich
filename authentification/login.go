package authentification

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"mess/database"
	"mess/encryption"
	usersModels "mess/models/usersModels"
	"mess/services"
	"net/http"

	"golang.org/x/crypto/bcrypt"
)

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-type", "application/json")
	if r.Method != http.MethodPost {
		log.Printf("method not allowed")
		services.ResponseFunc(w, http.StatusMethodNotAllowed, "method not allowed", nil)
		return
	}

	var ul usersModels.UserLogin
	if err := json.NewDecoder(r.Body).Decode(&ul); err != nil {
		log.Printf("failed to decode request,/auth/login\nerror:%v", err)
		services.ResponseFunc(w, http.StatusBadRequest, "failed to decode request", nil)
		return
	}

	err := encryption.CheckPasswordHash(ul)
	if err != nil {
		if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
			log.Printf("invalid password,/auth/login error:%v", err)
			services.ResponseFunc(w, http.StatusUnauthorized, "invalid password or email", nil)
			return
		}

		log.Printf("failed to check match passwords,/auth/login error:%v", err)
		services.ResponseFunc(w, http.StatusUnauthorized, "failed to check match passwords", nil)
		return
	}

	uid, err := database.GetUserID(ul)
	if err != nil {
		log.Printf("failed to get UserID,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to get UserID", nil)
		return
	}
	token, err := CreateJwt(uid)
	if err != nil {
		log.Printf("failed to create JWT /login, error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to create JWT", nil)
		return
	}
	fmt.Println("user login successfully\n" + token)
	services.ResponseFunc(w, http.StatusOK, "user login successfully", token)
}
