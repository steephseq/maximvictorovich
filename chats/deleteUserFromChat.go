package chats

import (
	"database/sql"
	"errors"
	"log"
	"mess/database"
	JWTModels "mess/models/services/jwt"
	"mess/services"
	"net/http"
	"strconv"
)

func RemoveUserFromChatHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		services.MethodNotAllowed(w, r)
		return
	}

	deletedUserStr := r.URL.Query().Get("user_id")
	chatIDStr := r.URL.Query().Get("chat_id")
	if deletedUserStr == "" || chatIDStr == "" {
		log.Printf("deleted user or chat id is empty")
		services.ResponseFunc(w, http.StatusBadRequest, "deleted user or chat id is empty", nil)
		return
	}
	deletedUser, err := strconv.Atoi(deletedUserStr)
	if err != nil {
		log.Printf("failed to convert deleted user to int,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to convert deleted user to int", nil)
		return
	}
	chatID, err := strconv.Atoi(chatIDStr)
	if err != nil {
		log.Printf("failed to convert chat id to int,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to convert chat id to int", nil)
		return
	}
	exists, err := database.IsUserINChat(chatID, deletedUser)
	if err != nil {
		log.Printf("failed to check is user into chat,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to check exists user into chat", nil)
		return
	}

	if !exists {
		log.Printf("DeleteUserFromChat: user not into chat")
		services.ResponseFunc(w, http.StatusNotFound, "user not into chat", nil)
		return
	}

	userIDAny := r.Context().Value(JWTModels.UserIDKey)
	userID, ok := userIDAny.(uint)
	if !ok {
		log.Printf("DeleteUserFromChat: Failed to parse userID")
		services.ResponseFunc(w, http.StatusInternalServerError, "invalid userID in context", nil)
		return
	}
	canDelete, err := database.CanUserX(int(userID), chatID, "can_delete_users")
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Printf("DeleteUserFromChat: user havent permission to delete user")
		} else {
			log.Printf("failed to check can delete user,error:%v", err)
			services.ResponseFunc(w, http.StatusInternalServerError, "failed to check can delete user", nil)
			return
		}
	}
	if !canDelete && int(userID) != deletedUser {
		log.Printf("DeleteUserFromChat: user cant delete user")
		services.ResponseFunc(w, http.StatusForbidden, "user can't delete user", nil)
		return
	}

	if err := database.DeleteUserFromChat(chatID, deletedUser); err != nil {
		log.Printf("failed to delete user from chat,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to delete user", nil)
		return
	}

	log.Printf("successful remove user from chat")
	services.ResponseFunc(w, http.StatusOK, "successful remove", nil)
}
