package chats

import (
	"encoding/json"
	"log"
	"mess/database"
	chatsModels "mess/models/chatsModels"
	JWTModels "mess/models/services/jwt"
	"mess/services"
	"net/http"
)

func CreateChat121Handler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		log.Printf("method not allowed")
		services.ResponseFunc(w, http.StatusMethodNotAllowed, "method not allowed", nil)
		return
	}

	var userFromRequest chatsModels.Create121ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&userFromRequest); err != nil {
		log.Printf("bad request")
		services.ResponseFunc(w, http.StatusBadRequest, "bad request", nil)
		return
	}
	userFromJWT := r.Context().Value(JWTModels.UserIDKey).(uint)
	u1, u2 := userFromRequest.User_ID, int(userFromJWT)

	var users []int
	if u1 < u2 {
		users = []int{u1, u2}
	} else {
		users = []int{u2, u1}
	}

	c := chatsModels.CreateChatRequest{
		Is_group: false,
		Users:    users,
	}

	chatID, err := database.CreateChat(c)
	if err != nil {
		log.Printf("failed to create chat,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to create chat", nil)
		return
	}
	_, _, err = database.AddUserIntoChat(chatID, users, r)
	if err != nil {
		log.Printf("failed to add users into chat,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to add users into chat", nil)
		return
	}

	log.Printf("successful add users into chat")
	services.ResponseFunc(w, http.StatusOK, "successful add user into chat", map[string]int{"chat_id": chatID})
}
