package profile

import (
	"log"
	"mess/database"
	chatsModels "mess/models/chatsModels"
	"mess/services"
	"net/http"
)

func OpenProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		services.MethodNotAllowed(w, r)
		return
	}

	var profileOBJRequest chatsModels.Chat
	if err := services.DecodeRequest(w, r, &profileOBJRequest); err != nil {
		return
	}

	responseProfile(profileOBJRequest, w)
}

func responseProfile(profileOBJRequest chatsModels.Chat, w http.ResponseWriter) {
	var err error
	var result interface{}

	if profileOBJRequest.Is_group {
		result, err = database.GetGroupProfile(profileOBJRequest)
	} else {
		result, err = database.GetUserProfile(profileOBJRequest.ID)
	}

	log.Printf("is group=%v", profileOBJRequest.Is_group)

	if err != nil {
		log.Printf("failed to get chatProfile,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to get profile", nil)
		return
	}

	log.Printf("successful get profile")
	services.ResponseFunc(w, http.StatusOK, "successful get profile", result)
}
