package chats

import (
	"encoding/json"
	"fmt"
	"log"
	"mess/database"
	chatsModels "mess/models/chatsModels"
	models "mess/models/services/jwt"
	usersModels "mess/models/usersModels"
	"mess/services"
	"net/http"
)

// create any type chat
func CreateChatHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		log.Printf("method not allowed")
		services.ResponseFunc(w, http.StatusMethodNotAllowed, "method not allowed", nil)
		return
	}

	var newChat chatsModels.CreateChatRequest
	if err := json.NewDecoder(r.Body).Decode(&newChat); err != nil {
		fmt.Printf("failed to decode chat create request,error:%v", err)
		services.ResponseFunc(w, http.StatusBadRequest, "failed to decode request", nil)
		return
	}
	chatID, err := database.CreateChat(newChat)
	if err != nil {
		log.Printf("failed to create chat,error:%v\nchat:%+v", err, newChat)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to create chat", nil)
		return
	}

	userID := r.Context().Value(models.UserIDKey).(uint)
	if err := database.AddCreatorToChat(chatID, int(userID)); err != nil {
		log.Printf("failed to add creator to chat")
	}

	if err := database.AddAdmin(usersModels.AdminRoots{
		UserID:            int(userID),
		ChatID:            chatID,
		CanDeleteMessages: true,
		CanBanUsers:       true,
		CanEditChatInfo:   true,
		CanManageRoles:    true,
	}); err != nil {
		log.Printf("failed to add admin,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to add admin", nil)
		return
	}
	log.Printf("successful add admin")

	newChat.Users = append(newChat.Users, int(userID))
	_, _, err = database.AddUserIntoChat(chatID, newChat.Users, r)
	if err != nil {
		log.Printf("failed to add user into,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to add user into chat", nil)
		return
	}
	log.Printf("successful create chat")
	services.ResponseFunc(w, http.StatusOK, "successful create chat", nil)
}
