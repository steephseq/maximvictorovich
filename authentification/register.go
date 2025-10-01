package authentification

import (
	"encoding/json"
	"log"
	"mess/database"
	"mess/encryption"
	usersModels "mess/models/usersModels"
	"mess/services"
	"net/http"
)

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("register handler trigged")

	if r.Method != http.MethodPost {
		services.ResponseFunc(w, http.StatusMethodNotAllowed, "method not allowed", nil)
		return
	}

	var u usersModels.User
	err := json.NewDecoder(r.Body).Decode(&u)
	log.Printf("Decoded user: %+v", u)
	if err != nil {
		services.ResponseFunc(w, http.StatusBadRequest, "invalid request", nil)
		return
	}

	exists, err := database.CheckPresenceUser(u)
	log.Printf("User exists: %v, err: %v", exists, err)
	if err != nil {
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to check presence user in DB", nil)
		return
	}

	if exists {
		services.ResponseFunc(w, http.StatusConflict, "user already exists", nil)
		return
	}

	hashPass, err := encryption.HashPasswordFunc(&u)
	log.Printf("Hashed password for user %s", u.Email)
	if err != nil {
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to hash password", nil)
		return
	}
	u.Password = hashPass
	err = database.AddUser(&u)
	if err != nil {
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to add user into DB"+err.Error(), nil)
		return
	}
	log.Printf("Added user to DB: %s", u.Email)
	services.ResponseFunc(w, http.StatusOK, "user added successfully", nil)
}
