package chats

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"mess/authentification"
	"mess/database"
	modelsChat "mess/models/chatsModels"
	"mess/services"

	"github.com/gorilla/websocket"
)

type ClientSM modelsChat.Client

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

var rooms = make(map[uint]map[*ClientSM]bool)

func SendMessageHandler(w http.ResponseWriter, r *http.Request) {
	chatIDstr := r.URL.Query().Get("id")
	chatID, err := strconv.Atoi(chatIDstr)
	if err != nil {
		log.Printf("failed to parse chatID,error:%v", err)
		services.ResponseFunc(w, http.StatusBadRequest, "failed to parse chatID", nil)
		return
	}
	log.Printf("chatID:%d", chatID)

	tokenStr := r.URL.Query().Get("token")
	userID, err := authentification.GetUserIDFromToken(tokenStr)
	if err != nil {
		log.Printf("failed to get userID,error:%v", err)
		services.ResponseFunc(w, http.StatusUnauthorized, "failed to get user id", nil)
		return
	}
	log.Printf("userID:%d", userID)

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("failed to upgrade ws, error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to upgrade ws", nil)
		return
	}
	log.Printf("ws connection is successfully")

	client := &ClientSM{
		Conn:   conn,
		ChatID: chatID,
		UserID: int(userID),
	}
	log.Printf("client is created")
	if rooms[uint(chatID)] == nil {
		rooms[uint(chatID)] = make(map[*ClientSM]bool)
	}

	rooms[uint(chatID)][client] = true
	log.Println("cleintd is added into rooms")
	go client.ReadPump(w, rooms)
}

func (c *ClientSM) ReadPump(w http.ResponseWriter, rooms map[uint]map[*ClientSM]bool) {
	defer func() {
		delete(rooms[uint(c.ChatID)], c)
		c.Conn.Close()
	}()

	for {
		_, messageBytes, err := c.Conn.ReadMessage()
		if err != nil {
			log.Printf("read error:%v", err)
			break
		}

		var msg modelsChat.Message
		if err = json.Unmarshal(messageBytes, &msg); err != nil {
			log.Printf("failed to unmarshal msg,error%v", err)
			continue
		}

		msg.UserId = c.UserID
		msg.ChatId = int(c.ChatID)
		msg.CreatedAt = time.Now()

		if _, err = database.SaveMessageToDB(msg); err != nil {
			log.Printf("failed to add msg into db,error:%v", err)
			continue
		}
		broadcastToRoom(msg, c.ChatID)
		log.Printf("successfully add message to db")
	}
}

func broadcastToRoom(msg modelsChat.Message, chatID int) {
	for client := range rooms[uint(chatID)] {
		msgBytes, err := json.Marshal(msg)
		if err != nil {
			log.Printf("failed to marshal msg,error:%v", err)
			continue
		}

		if err := client.Conn.WriteMessage(websocket.TextMessage, msgBytes); err != nil {
			log.Printf("failed to write message,error:%v", err)
			client.Conn.Close()
			delete(rooms[uint(chatID)], client)
		}

	}
}
