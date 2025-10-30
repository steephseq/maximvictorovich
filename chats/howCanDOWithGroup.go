package chats

import (
	"mess/database"
	JWTModels "mess/models/services/jwt"
	"mess/services"
	"net/http"
	"strconv"
)

func HowCanDoWithGroupHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		services.MethodNotAllowed(w, r)
		return
	}

	userIDAny := r.Context().Value(JWTModels.UserIDKey)
	userID, ok := userIDAny.(int)
	if !ok {
		services.ResponseFunc(w, http.StatusUnauthorized, "Unauthorized", nil)
		return
	}

	chatIDStr := r.URL.Query().Get("chatID")
	if chatIDStr == "" {
		services.ResponseFunc(w, http.StatusBadRequest, "Bad Request", nil)
		return
	}
	chatID, err := strconv.Atoi(chatIDStr)
	if err != nil {
		services.ResponseFunc(w, http.StatusBadRequest, "Bad Request", nil)
		return
	}

	actions, err := database.GetGroupActions(userID, chatID)
	if err != nil {
		services.ResponseFunc(w, http.StatusInternalServerError, "Internal Server Error", nil)
		return
	}
	services.ResponseFunc(w, http.StatusOK, "successful", actions)
}
