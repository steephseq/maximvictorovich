package chats

import (
	"log"
	"mess/database"
	models "mess/models/services/jwt"
	"mess/services"
	"net/http"
	"strconv"
)

func HowCanIDoWithMessageHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		services.MethodNotAllowed(w, r)
		return
	}

	chatIDStr := r.URL.Query().Get("id")
	chatID, err := strconv.Atoi(chatIDStr)
	if err != nil {
		services.ResponseFunc(w, http.StatusBadRequest, "invalid chatid", nil)
		return
	}
	chatExists, err := database.ChatExistsByID(uint64(chatID))
	if err != nil {
		services.ResponseFunc(w, http.StatusInternalServerError, "failed check chat exists", nil)
		return
	}

	if !chatExists {
		services.ResponseFunc(w, http.StatusNotFound, "chat not exists", nil)
		return
	}

	messIDStr := r.URL.Query().Get("mid")
	messID, err := strconv.Atoi(messIDStr)
	if err != nil {
		services.ResponseFunc(w, http.StatusBadRequest, "bad request", nil)
		return
	}

	userID := int(r.Context().Value(models.UserIDKey).(uint))
	actions, err := database.GetAvailableMessageActions(userID, chatID, messID)
	if err != nil {
		log.Printf("error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to get roots", nil)
		return
	}
	services.ResponseFunc(w, http.StatusOK, "successful get actions", actions)
}
