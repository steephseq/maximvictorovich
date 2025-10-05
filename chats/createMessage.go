//create empty message for displaying files

package chats

import (
	"mess/database"
	chatsModels "mess/models/chatsModels"
	JWTModels "mess/models/services/jwt"
	"mess/services"
	"net/http"
	"time"
)

func CreateEmptyMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		services.MethodNotAllowed(w, r)
		return
	}

	var mess chatsModels.Message
	if err := services.DecodeRequest(w, r, &mess); err != nil {
		services.ResponseFunc(w, http.StatusBadRequest, "failed to decode request", nil)
		return
	}

	userID := r.Context().Value(JWTModels.UserIDKey)
	uID, ok := userID.(uint)
	if !ok {
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to get user id", nil)
		return
	}
	mess.UserId = int(uID)
	mess.CreatedAt = time.Now()

	id, err := database.SaveMessageToDB(mess)
	if err != nil {
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to save message", nil)
		return
	}
	services.ResponseFunc(w, http.StatusOK, "message created", id)
}
