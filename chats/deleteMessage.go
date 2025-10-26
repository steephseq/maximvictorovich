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

	canDelete, err := database.CanUserX(userID, action.ChatID, action.Action)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("DeleteMessageHandler: failed to check permissions user,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to check have user roots", nil)
		return
	}
	if !canDelete {

		authorID, err := database.WhoAuthorMessage(action.MessageID, action.ChatID)
		if err != nil {
			log.Printf("DeleteUserHandler: failed to check who is author message,error:%v", err)
			services.ResponseFunc(w, http.StatusInternalServerError, "failed to get authorID", nil)
			return
		}
		canDelete = (authorID == userID)
	}

	if !canDelete {
		services.ResponseFunc(w, http.StatusForbidden, "cant delete message", nil)
		return
	}

	if err := database.DeleteMessage(action); err != nil {
		log.Printf("DeleteMessageHandler: failed to delete message,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to delete message", nil)
		return
	}
	services.ResponseFunc(w, http.StatusOK, "successful delete message", nil)
}
