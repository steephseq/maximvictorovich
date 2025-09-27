package chats

import (
	"log"
	"mess/database"
	chatsModels "mess/models/chatsModels"
	"mess/services"
	"net/http"
)

func RemoveUserFromChatHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		services.MethodNotAllowed(w, r)
		return
	}

	var removeRequest chatsModels.RemoveRequest
	if err := services.DecodeRequest(w, r, &removeRequest); err != nil {
		return
	}

	inChat, err := database.IsUserINChat(removeRequest.ChatID, removeRequest.Users)
	if err != nil {
		log.Printf("failed to check is user into chat,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to check exists user into chat", nil)
		return
	}

	if err := database.DeleteUserFromChat(removeRequest.ChatID, inChat); err != nil {
		log.Printf("failed to delete user from chat,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to delete user", nil)
		return
	}

	log.Printf("successful remove user from chat")
	services.ResponseFunc(w, http.StatusOK, "successful remove", inChat)
}
