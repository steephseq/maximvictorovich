package chats

import (
	"fmt"
	"log"
	"mess/database"
	"mess/services"
	"net/http"
	"reflect"
	"strconv"
)

func ShowMessagesHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("ShowMessagesHandler trigged")
	if r.Method != http.MethodGet {
		services.ResponseFunc(w, http.StatusMethodNotAllowed, "method not allowed", nil)
		return
	}
	idStr := r.URL.Query().Get("id")
	fmt.Println("id=", idStr, reflect.TypeOf(idStr))
	chatID, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		log.Printf("failed to parse chatID to uint, error:%v", err)
		services.ResponseFunc(w, http.StatusBadRequest, "failed to parse chatid", nil)
		return
	}

	exists, err := database.ChatExistsByID(chatID)
	if err != nil {
		log.Printf("failed to check exists chat,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to find chat", nil)
		return
	}
	if !exists {
		log.Printf("chat not found")
		services.ResponseFunc(w, http.StatusNotFound, "chat not Found", nil)
		return
	}

	messages, err := database.GetMessages(chatID)
	if err != nil {
		log.Printf("failed to get messages,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to get messages", nil)
		return
	}

	log.Printf("successful get messages,messages:%d", len(messages))
	services.ResponseFunc(w, http.StatusOK, "successfully get messages", messages)
}
