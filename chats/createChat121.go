package chats

import (
	"encoding/json"
	"log"
	"mess/database"
	chatsModels "mess/models/chatsModels"
	JWTModels "mess/models/services/jwt"
	"mess/services"
	"net/http"
	"time"
)

func CreateChat121Handler(w http.ResponseWriter, r *http.Request) {
	log.Println("create 121 chat triggered")
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
	u1 := userFromRequest.User_ID

	var users []int
	users = append(users, u1)

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
	log.Println("successful create chat")
	_, _, err = database.AddUserIntoChat(chatID, users, r)
	if err != nil {
		log.Printf("failed to add users into chat,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to add users into chat", nil)
		return
	}

	if err := database.AddCreatorToChat(chatID, int(userFromJWT)); err != nil {
		log.Println("failed to add creator into chat")
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to add users into chat", nil)
		return
	}

	userInfo, err := database.GetUserProfile(u1)
	if err != nil {
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to get info", nil)
		return
	}
	chatInfo := map[string]interface{}{
		"id":         chatID,
		"name":       userInfo.Name,
		"avatar":     userInfo.Avatar,
		"is_group":   false,
		"created_at": time.Now()}
	log.Printf("successful add users into chat")
	services.ResponseFunc(w, http.StatusOK, "successful add user into chat", chatInfo)
}
