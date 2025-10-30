package onlineStatus

import (
	"context"
	"fmt"
	"log"
	"mess/database"
	chatsModels "mess/models/chatsModels"
	"mess/redis"
	"mess/services"
	"strconv"
	"time"
)

type ClientSM chatsModels.Client

func SendMessageToChatsChannels(key string, userID int, message string) {
	allChats, err := database.GetChatsByUserID(userID)
	if err != nil {
		log.Printf("failed to get chats by user id, error:%v", err)
		return
	}
	for _, chat := range allChats {
		redis.RedisClient.Publish(redis.Ctx, fmt.Sprintf(key+":%d", chat.ID), message)
	}
}

func SetupChatRoom(ctx context.Context, typeMessage string, chatID int, key string) {
	pubSub := redis.RedisClient.Subscribe(redis.Ctx, fmt.Sprintf(key+":%d", chatID))
	go func() {
		defer pubSub.Close()
		for {
			select {
			case <-ctx.Done():
				return
			case <-pubSub.Channel():
				onlineCount, err := redis.CalculateOnlineUsers(chatID)
				if err != nil {
					log.Printf("failed to calculate online users, error:%v", err)
					continue
				}
				message := chatsModels.Message{
					Type:      typeMessage, // ← фронт поймет что это не текст
					ChatId:    chatID,
					Content:   strconv.Itoa(onlineCount),
					CreatedAt: time.Now(),
				}
				services.BroadcastToRoom(message, chatID)

			}
		}
	}()
}
