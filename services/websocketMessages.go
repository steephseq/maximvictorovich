package services

import (
	"encoding/json"
	"log"
	chatsModels "mess/models/chatsModels"

	"github.com/gorilla/websocket"
)

func BroadcastToRoom(msg chatsModels.Message, chatID int) {
	Hub.mu.Lock()
	clients, ok := Hub.clients[chatID]
	Hub.mu.Unlock()
	if !ok {
		return
	}

	msgBytes, err := json.Marshal(msg)
	if err != nil {
		log.Printf("failed to marshal msg,error:%v", err)
		return
	}
	for client := range clients {
		if err := client.Conn.WriteMessage(websocket.TextMessage, msgBytes); err != nil {
			log.Printf("failed to write message,error:%v", err)
			client.Conn.Close()
			Hub.mu.Lock()
			delete(Hub.clients[chatID], client)
			Hub.mu.Unlock()
		}
	}
}
