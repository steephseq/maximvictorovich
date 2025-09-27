package chats

import (
	"encoding/json"
	"log"
	"mess/database"
	models "mess/models/services/jwt"
	"mess/services"
	"net/http"
)

func ExistsChatHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		log.Printf("method not allowed")
		services.ResponseFunc(w, http.StatusMethodNotAllowed, "method not allowed", nil)
		return
	}
	log.Printf("trigged exists handler")

	type UserReqest struct {
		UserID int `json:"user_id"`
	}
	var req UserReqest
	//var userFromRequest chatsModels.Create121ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("failed to decode request")
		services.ResponseFunc(w, http.StatusBadRequest, "bad request", nil)
		return
	}
	userFromRequest := req.UserID
	userFromJWT := r.Context().Value(models.UserIDKey).(uint)
	users := []int{userFromRequest, int(userFromJWT)}

	exists, err := database.ChatExists121ByUsers(users[0], users[1])
	if err != nil {
		log.Printf("failed to check chat121 exists by users,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to check chat exists,error:%v", err)
		return
	}
	if exists {
		log.Printf("chat already exists")
		services.ResponseFunc(w, http.StatusOK, "chat already exists", nil)
		return
	}
	log.Printf("chat not exists")
	services.ResponseFunc(w, http.StatusNotFound, "chat not found", nil)
}
