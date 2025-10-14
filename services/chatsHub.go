package services

import (
	"context"
	"fmt"
	"log"
	chatsModels "mess/models/chatsModels"
	"mess/redis"
	"strconv"
	"sync"
	"time"
)

type ChatHub struct {
	clients    map[int]map[*chatsModels.Client]bool
	subRunning map[int]bool
	subCancel  map[int]context.CancelFunc
	mu         sync.Mutex
}

var Hub = &ChatHub{
	clients:    make(map[int]map[*chatsModels.Client]bool),
	subRunning: make(map[int]bool),
	subCancel:  make(map[int]context.CancelFunc),
}

func AddClientToHub(chatID int, client *chatsModels.Client) {
	Hub.mu.Lock()
	defer Hub.mu.Unlock()
	if Hub.clients[chatID] == nil {
		Hub.clients[chatID] = make(map[*chatsModels.Client]bool)
	}
	Hub.clients[chatID][client] = true
}

func RemoveClientFromHub(chatID int, client *chatsModels.Client) {
	Hub.mu.Lock()
	defer Hub.mu.Unlock()

	if Hub.clients[chatID] == nil {
		return
	}

	if len(Hub.clients[chatID]) == 0 {
		if cancel, ok := Hub.subCancel[chatID]; ok {
			cancel()
			delete(Hub.subCancel, chatID)
		}
		delete(Hub.subRunning, chatID)
		delete(Hub.clients[chatID], client)
	}
}

func EnsureChatSubscription(chatID int, typeMessage string, key string) {
	Hub.mu.Lock()
	if Hub.subRunning[chatID] {
		Hub.mu.Unlock()
		return
	}
	Hub.subRunning[chatID] = true
	ctx, cancel := context.WithCancel(context.Background())
	Hub.subCancel[chatID] = cancel
	Hub.mu.Unlock()
	go func() {
		pubsub := redis.RedisClient.Subscribe(redis.Ctx, fmt.Sprintf(key+":%d", chatID))
		defer func() {
			if err := pubsub.Close(); err != nil {
				log.Printf("failed to close pubsub, error:%v", err)
			}
		}()
		for {
			select {
			case <-ctx.Done():
				return
			case <-pubsub.Channel():
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
				BroadcastToRoom(message, chatID)
			}
		}
	}()
}
