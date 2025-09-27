package chats

import (
	"database/sql"
	"log"
	"mess/database"
	chatsModels "mess/models/chatsModels"
	models "mess/models/services/jwt"
	"mess/services"
	"net/http"
)

func DeleteMessageHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		services.MethodNotAllowed(w, r)
		return
	}

	var action chatsModels.ActionInChat
	if err := services.DecodeRequest(w, r, &action); err != nil {
		return
	}

	userID := int(r.Context().Value(models.UserIDKey).(uint))
	var authorID int

	canDelete, err := database.CanUserX(userID, action.ChatID, action.Action)
	if err != nil {
		if err != sql.ErrNoRows {
			log.Printf("failed to check have user roots for action,error:%v", err)
			services.ResponseFunc(w, http.StatusInternalServerError, "failed to check have user roots", nil)
			return
		}

		authorID, err = database.WhoAuthorMessage(action.MessageID, action.ChatID)
		if err != nil {
			services.ResponseFunc(w, http.StatusInternalServerError, "failed to get authorID", nil)
			return
		}
	}
	isAuthor := authorID == userID
	if !isAuthor && !canDelete {
		services.ResponseFunc(w, http.StatusForbidden, "cant delete message", nil)
		return
	}

	if err := database.DeleteMessage(action); err != nil {
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to delete message", nil)
		return
	}
	services.ResponseFunc(w, http.StatusOK, "successful delete message", nil)
}
