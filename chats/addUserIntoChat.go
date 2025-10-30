package chats

import (
	"log"
	"mess/database"
	chatsModels "mess/models/chatsModels"
	"mess/services"
	"net/http"
)

func AddUserIntoChatHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		services.MethodNotAllowed(w, r)
		return
	}

	var users chatsModels.AddUsers
	if err := services.DecodeRequest(w, r, &users); err != nil {
		return
	}

	added, alreadyExists, err := database.AddUserIntoChat(users.ChatID, users.Users, r)
	if err != nil {
		log.Printf("failed to add users into chat,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to add users", nil)
		return
	}

	log.Printf("AddUserIntoChaT: successful add users into chat")
	services.ResponseFunc(w, http.StatusOK, "successful add users", map[string][]int{"added": added, "alreadyExists": alreadyExists})

}
