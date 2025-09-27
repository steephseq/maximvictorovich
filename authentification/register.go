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
	w.Header().Set("Content-Type", "application/json") // всегда устанавливаем

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
	services.ResponseFunc(w, http.StatusCreated, "user added successfully", nil)
}

/*func RegisterHandler(w http.ResponseWriter, r *http.Request) {

	if r.Method != http.MethodPost {
		mess := "method not allowed"
		services.ResponseFunc(w, http.StatusMethodNotAllowed, mess, nil)
		return
	}

	var u modelsUser.User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		log.Printf("failed to decode request,error:%v", err)
		mess := "invalid request"
		services.ResponseFunc(w, http.StatusBadRequest, mess, nil)
		return
	}

	exists, err := database.CheckPresenceUser(u)
	if err != nil {
		/*log.Printf("failed to add user %s:%v", u.Email, err)
		mess := "failed to check presence user in DB:error:" + err.Error()
		services.ResponseFunc(w, http.StatusInternalServerError, mess, nil)
		return
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(responseModels.Response{
			Code:    http.StatusInternalServerError,
			Message: "failed to check presence user in DB",
		})
		return
	}

	if exists {
		/*log.Printf("user already exists %s", u.Email)
		mess := "user already exists"
		services.ResponseFunc(w, http.StatusConflict, mess, nil)
		return

		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(responseModels.Response{
			Code:    http.StatusInternalServerError,
			Message: "failed to check presence user in DB",
		})
		return
	}

	hashPass, err := encryption.HashPasswordFunc(&u)
	if err != nil {
		/*log.Printf("failed to hash password, error:%v", err.Error())
		mess := "failed to hash password"
		services.ResponseFunc(w, http.StatusInternalServerError, mess, nil)

		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(responseModels.Response{
			Code:    http.StatusInternalServerError,
			Message: "failed to hash password",
		})
		return
	}

	if err := database.AddUser(&u, hashPass); err != nil {
		/*log.Printf("failed to add user %s:%v", u.Email, err)
		mess := "failed to add user into DB"
		services.ResponseFunc(w, http.StatusInternalServerError, mess, nil)

		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(responseModels.Response{
			Code:    http.StatusInternalServerError,
			Message: "failed to add user into DB",
		})
		return
	}

	/*mess := "user  register successfully"
	services.ResponseFunc(w, http.StatusCreated, mess, nil)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(responseModels.Response{
		Code:    http.StatusOK,
		Message: "user add successfully",
	})

}*/
