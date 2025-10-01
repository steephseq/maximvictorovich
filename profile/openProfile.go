package profile

import (
	"fmt"
	"log"
	"mess/database"
	chatsModels "mess/models/chatsModels"
	profileModels "mess/models/profileModels"
	JWTModels "mess/models/services/jwt"
	usersModels "mess/models/usersModels"
	"mess/services"
	"net/http"
)

func OpenProfile(w http.ResponseWriter, r *http.Request) {
	log.Println("profile handler trigged")
	if r.Method != http.MethodPost {
		services.MethodNotAllowed(w, r)
		return
	}

	var profileOBJRequest chatsModels.Chat
	if err := services.DecodeRequest(w, r, &profileOBJRequest); err != nil {
		return
	}
	log.Println(profileOBJRequest)
	responseProfile(profileOBJRequest, w, r)
}

func responseProfile(profileOBJRequest chatsModels.Chat, w http.ResponseWriter, r *http.Request) {
	var err error
	var resultUser usersModels.User
	var resultGroup profileModels.GroupProfile
	if profileOBJRequest.Is_group {
		resultGroup, err = database.GetGroupProfile(profileOBJRequest)
		if err != nil {
			log.Println(err)
			services.ResponseFunc(w, http.StatusInternalServerError, "failed to get group profile", nil)
			return
		}
		services.ResponseFunc(w, http.StatusOK, "successful", resultGroup)
		return
	} else {
		userIDuint := r.Context().Value(JWTModels.UserIDKey)
		userID, ok := userIDuint.(uint)
		if !ok {
			services.ResponseFunc(w, http.StatusUnauthorized, "invalid token", nil)
			return
		}
		uid, err := database.GetAnotherUserForProfile(profileOBJRequest.ID, int(userID))
		if err != nil {
			services.ResponseFunc(w, http.StatusInternalServerError, "failed to get user profile", nil)
			return
		}
		resultUser, err = database.GetUserProfile(uid)
		if err != nil {
			log.Println(err)
			if err == fmt.Errorf("user not found") {
				resultUser.Name = "Deleted Account"
			} else {
				services.ResponseFunc(w, http.StatusInternalServerError, "failed to get user profile", nil)
				return
			}
		}
		services.ResponseFunc(w, http.StatusOK, "successful", resultUser)
	}
}

func MyProfileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		services.MethodNotAllowed(w, r)
		return
	}

	userID := r.Context().Value(JWTModels.UserIDKey).(uint)
	u, err := database.GetMyProfileHP(int(userID))
	if err != nil {
		log.Printf("%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed get user profile", nil)
		return
	}
	services.ResponseFunc(w, http.StatusOK, "successful get profile", u)
}
