package chats

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"mess/authentification"
	"mess/database"
	chatsModels "mess/models/chatsModels"
	"mess/services"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func SendMessageHandler(w http.ResponseWriter, r *http.Request) {
	chatIDstr := r.URL.Query().Get("chat_id")
	chatID, err := strconv.Atoi(chatIDstr)
	if err != nil {
		log.Printf("failed to parse chatID,error:%v", err)
		services.ResponseFunc(w, http.StatusBadRequest, "failed to parse chatID", nil)
		return
	}

	tokenStr := r.URL.Query().Get("token")
	userID, err := authentification.GetUserIDFromToken(tokenStr)
	if err != nil {
		log.Printf("failed to get userID,error:%v", err)
		services.ResponseFunc(w, http.StatusUnauthorized, "failed to get user id", nil)
		return
	}
	exists, err := database.IsUserINChat(int(chatID), int(userID))
	if err != nil {
		log.Printf("SendMessageHandler: failed to check user in chat,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to check user in chat", nil)
		return
	}
	if !exists {
		services.ResponseFunc(w, http.StatusNotFound, "user not in chat", nil)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("failed to upgrade ws, error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to upgrade ws", nil)
		return
	}

	client := &chatsModels.Client{
		Conn:   conn,
		ChatID: chatID,
		UserID: int(userID),
	}
	services.AddClientToHub(chatID, client)
	services.EnsureChatSubscription(chatID, "online_count", "chat_event")
	go ReadPump(w, client)
}

func ReadPump(w http.ResponseWriter, c *chatsModels.Client) {
	defer func() {
		services.RemoveClientFromHub(c.ChatID, c)
		c.Conn.Close()
	}()
	for {
		_, messageBytes, err := c.Conn.ReadMessage()
		if err != nil {
			log.Printf("read error:%v", err)
			break
		}

		var msg chatsModels.Message
		if err = json.Unmarshal(messageBytes, &msg); err != nil {
			log.Printf("failed to unmarshal msg,error%v", err)
			continue
		}

		msg.UserId = c.UserID
		msg.ChatId = int(c.ChatID)
		msg.CreatedAt = time.Now()
		msg.IsReady = true

		exists, err := database.IsUserINChat(int(c.ChatID), c.UserID)
		if err != nil {
			log.Printf("SendMessageHandler: failed to check user in chat,error:%v", err)
			continue
		}
		if !exists {
			log.Printf("SendMessageHandler: user %d is not in chat %d", c.UserID, c.ChatID)
			continue
		}
		if _, err = database.SaveMessageToDB(msg); err != nil {
			log.Printf("SendMessageHandler: failed to add msg into db,error:%v", err)
			continue
		}

		services.BroadcastToRoom(msg, c.ChatID)
		log.Printf("SendMessageHandler: successfully add message to db")
	}
}
