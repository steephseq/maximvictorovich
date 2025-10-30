package chats

import (
	"fmt"
	"log"
	"mess/database"
	chatsModels "mess/models/chatsModels"
	models "mess/models/services/jwt"
	"mess/redis"
	"mess/services"
	"net/http"
	"time"
)

// func for get chats on home page
func GetChatsForHP(r *http.Request) ([]chatsModels.Chat, error) {
	if r.Method != http.MethodGet {
		log.Printf("method not allowed from GetChatsForHP")
		return nil, fmt.Errorf("error:%s", "method not allowed")
	}

	offsetStr := r.URL.Query().Get("offset")
	var offset time.Time
	var err error

	if offsetStr == "" || offsetStr == "0" {
		// Если offset не указан или 0 - используем текущее время
		offset = time.Now()
	} else {
		// Парсим как RFC3339 timestamp
		offset, err = time.Parse(time.RFC3339, offsetStr)
		if err != nil {
			log.Printf("failed to parse offset '%s' from GetChatsForHP, using current time, error:%v", offsetStr, err)
			offset = time.Now() // fallback на текущее время
		}
	}

	userID, ok := r.Context().Value(models.UserIDKey).(uint)
	if !ok {
		return nil, fmt.Errorf("failed to get user id")
	}

	chatsLst, err := database.GetChatsForHomePage(int(userID), offset)
	if err != nil {
		log.Printf("failed to Get chats for home page,error:%v", err)
		return nil, err
	}

	// Проверка онлайн статуса
	for i, chat := range chatsLst {
		if !chat.Is_group {
			chatsLst[i].IsOnline = false
			exists, err := redis.RedisClient.SIsMember(redis.Ctx, "online:users", chat.OtherUserID).Result()
			if exists && err == nil {
				chatsLst[i].IsOnline = true
				continue
			} else if err != nil {
				log.Printf("GetChatsForHP: failed to check is user online, error:%v", err)
			}
			lastSeen, err := redis.RedisClient.HGet(redis.Ctx, fmt.Sprintf("user:%d:status", chat.OtherUserID), "last_seen").Result()
			if err == nil && lastSeen != "" {
				chatsLst[i].LastSeen, err = time.Parse(time.RFC3339, lastSeen)
				if err != nil {
					chatsLst[i].IsOnline = false
					log.Printf("failed to parse last seen /GetChatsForHP\nerror:%v", err)
					continue
				}
				continue
			} else if err != nil {
				log.Printf("GetChatsForHP: failed to get last seen from redis, error:%v", err)
			}
			lastSeen, err = database.UserLastSeen(int(chat.OtherUserID))
			if err != nil {
				chatsLst[i].IsOnline = false
				log.Printf("failed to get last seen /GetChatsForHP\nerror:%v", err)
				continue
			}
			chatsLst[i].LastSeen, err = time.Parse(time.RFC3339, lastSeen)
			if err != nil {
				chatsLst[i].IsOnline = false
				log.Printf("failed to parse last seen /GetChatsForHP\nerror:%v", err)
				continue
			}
		} else {
			url := services.GetAvatarURL(*chat.AvatarURL)
			chatsLst[i].AvatarURL = &url
		}
	}
	// Форматируем ответ
	return chatsLst, nil
}
