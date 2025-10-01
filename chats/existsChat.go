package chats

import (
	"database/sql"
	"encoding/json"
	"errors"
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

	type UserRequest struct {
		UserID int `json:"user_id"`
	}
	var req UserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("failed to decode request")
		services.ResponseFunc(w, http.StatusBadRequest, "bad request", nil)
		return
	}
	log.Println(req)
	userFromRequest := req.UserID
	userFromJWT := r.Context().Value(models.UserIDKey).(uint)

	chatID, err := database.ChatExists121ByUsers(userFromRequest, int(userFromJWT))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Printf("chat is not exists")
			services.ResponseFunc(w, http.StatusNotFound, "chat not exists", nil)
			return
		}
		log.Printf("failed to check chat121 exists by users,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to check chat exists", nil)
		return
	}
	log.Printf("chat exists")
	services.ResponseFunc(w, http.StatusOK, "chat exists", chatID)
}
