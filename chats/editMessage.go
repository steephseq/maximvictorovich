package chats

import (
	"log"
	"mess/database"
	chatsModels "mess/models/chatsModels"
	JWTModels "mess/models/services/jwt"
	"mess/services"
	"net/http"
)

func EditMessageHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("edit messge trigger")
	if r.Method != http.MethodPatch {
		services.ResponseFunc(w, http.StatusMethodNotAllowed, "Method Not Allowed", nil)
		return
	}

	var newMessage chatsModels.Message
	if err := services.DecodeRequest(w, r, &newMessage); err != nil {
		log.Printf("EditMessageHandler:failed to decode request,err:%v", err)
		return
	}
	exists, err := database.ExistsMessageByID(uint64(newMessage.ID))
	if err != nil {
		log.Printf("EditMessageHandler: failed to check exists message, error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "Internal Server Error", nil)
		return
	}
	if !exists {
		log.Printf("EditMessageHandler:message not exists,id:%d", newMessage.ID)
		services.ResponseFunc(w, http.StatusNotFound, "Not Found", nil)
		return
	}
	log.Printf("код дошел до сюда")

	userIDAny := r.Context().Value(JWTModels.UserIDKey)
	userID, ok := userIDAny.(uint)
	if !ok {
		log.Printf("EditMessageHandler: failed to parse userID,error:%v", err)
		services.ResponseFunc(w, http.StatusUnauthorized, "Unauthorized", nil)
		return
	}

	if newMessage.UserId != int(userID) {
		log.Printf("EditMessageHadler:user cant edit this message")
		services.ResponseFunc(w, http.StatusUnauthorized, "Unauthorized", nil)
		return
	}
	log.Printf("код дошел до сюда")

	if newMessage.Content == "" {
		log.Printf("EditMessageHandler: new message cant be empty")
		services.ResponseFunc(w, http.StatusBadRequest, "Bad Request", nil)
		return
	}

	exists, err = database.ChatExistsByID(uint64(newMessage.ChatId))
	if err != nil {
		log.Printf("EditMessageHandler: failed to check exists chat,err:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "Internal Server Error", nil)
		return
	}
	if !exists {
		log.Printf("EditMessageHandler: chat isnt exists")
		services.ResponseFunc(w, http.StatusNotFound, "Not Found", nil)
		return
	}

	newMessage.Content, ok = newMessage.Content.(string)
	if !ok {
		log.Printf("EditMessageHandler: failed to parse newMessage.Content,err:%v", err)
		services.ResponseFunc(w, http.StatusBadRequest, "Bad Request", nil)
		return
	}
	log.Printf("код дошел до сюда")

	if err := database.UpdateMessage(newMessage.ID, newMessage.Content.(string), newMessage.IsReady); err != nil {
		log.Printf("EditMessageHandler:failed to update message,err:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "Internal Server Error", nil)
		return
	}
	services.ResponseFunc(w, http.StatusOK, "successful", nil)
}
