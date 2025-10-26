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

func HowCanDoWithUserHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		services.MethodNotAllowed(w, r)
		return
	}

	chatIDStr := r.URL.Query().Get("chat_id")
	userIDAny := r.Context().Value(JWTModels.UserIDKey)

	chatID, err := strconv.Atoi(chatIDStr)
	if err != nil {
		log.Printf("HowCanDoWithUser: failed to convert chat id to int,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to convert chat id to int", nil)
		return
	}

	if userIDAny == nil {
		log.Printf("HowCanDoWithUser: userID is empty")
		services.ResponseFunc(w, http.StatusNotFound, "userID is empty", nil)
		return
	}
	userID, ok := userIDAny.(uint)
	if !ok {
		log.Printf("HowCanDoWithUser: Failed to parse userID")
		services.ResponseFunc(w, http.StatusInternalServerError, "invalid userID in context", nil)
		return
	}

	avaliableActions, err := database.GetAvaliableUserActions(int(userID), chatID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Printf("HowCanDoWithUser: user is not admin")
			services.ResponseFunc(w, http.StatusForbidden, "u is not admin", nil)
			return
		} else {
			log.Printf("HowCanDoWithUser: failed to get avaliable actions,error:%v", err)
			services.ResponseFunc(w, http.StatusInternalServerError, "failed to get avaliable actions", nil)
			return
		}
	}
	services.ResponseFunc(w, http.StatusOK, "successful", avaliableActions)
}
