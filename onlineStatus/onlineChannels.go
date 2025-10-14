package onlineStatus

import (
	"context"
	"fmt"
	"log"
	"mess/database"
	chatsModels "mess/models/chatsModels"
	"mess/redis"
	"mess/services"
	"slices"
	"strconv"
	"time"
)

type ClientSM chatsModels.Client

func SendMessageToChatsChannels(key string, userID int, message string) error {
	allChats, err := database.GetChatsByUserID(userID)
	if err != nil {
		return err
	}
	for _, chat := range allChats {
		redis.RedisClient.Publish(redis.Ctx, fmt.Sprintf(key+":%d", chat.ID), message)
	}

	return nil
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
				profile, err := database.GetGroupProfile(chatsModels.Chat{ID: chatID, Is_group: true})
				if err != nil {
					log.Printf("failed to get group profile for update, error:%v", err)
					continue
				}
				exists, err := redis.RedisClient.SMembers(redis.Ctx, fmt.Sprintf("chat_online_users:%d", chatID)).Result()
				if err != nil {
					log.Printf("failed to get online members, error:%v", err)
					continue
				}
				for i, user := range profile.Members {
					if slices.Contains(exists, strconv.Itoa(int(user.ID))) {
						profile.Members[i].IsOnline = true
					} else {
						profile.Members[i].IsOnline = false
					}
				}
				message = chatsModels.Message{
					Type:      "group_profile_update", // ← фронт поймет что это не текст
					ChatId:    chatID,
					Content:   profile,
					CreatedAt: time.Now(),
				}
				services.BroadcastToRoom(message, chatID)
			}
		}
	}()
}
