package chats

import (
	"log"
	"mess/database"
	usersModels "mess/models/usersModels"
	"mess/services"
	"net/http"
)

func MadeAdminHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		services.MethodNotAllowed(w, r)
		return
	}

	var Admin usersModels.AdminRoots
	if err := services.DecodeRequest(w, r, &Admin); err != nil {
		log.Printf("bad request")
		services.ResponseFunc(w, http.StatusBadRequest, "bad request", nil)
		return
	}

	if err := database.AddAdmin(Admin); err != nil {
		log.Printf("failed to add admin")
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to add admin", nil)
		return
	}
	log.Printf("successful add new admin")
	services.ResponseFunc(w, http.StatusOK, "successful new admin", nil)
}
