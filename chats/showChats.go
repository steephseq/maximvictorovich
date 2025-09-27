package chats

import (
	"log"
	"mess/services"
	"net/http"
)

func ShowChatsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-type", "application/json")
	if r.Method != http.MethodGet {
		log.Printf("method not allowed")
		services.ResponseFunc(w, http.StatusMethodNotAllowed, "method not allowed", nil)
		return
	}
	chats, err := GetChatsForHP(r)
	if err != nil {
		log.Printf("failed to get chats for hp,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to get chats", nil)
		return
	}
	log.Printf("successful get chats for hp")
	services.ResponseFunc(w, http.StatusOK, "successful get chats", chats)
}
