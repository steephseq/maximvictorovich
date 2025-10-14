package chats

import (
	"fmt"
	"log"
	"mess/database"
	chatsModels "mess/models/chatsModels"
	models "mess/models/services/jwt"
	"mess/redis"
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
	if offsetStr == "0" {
		offset = time.Now()
	} else {
		offset, err = time.Parse(time.RFC3339, offsetStr)
		if err != nil {
			log.Printf("failed to parse offset from GetChatsForHP,error:%v", err)
			return nil, err
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

	for i, chat := range chatsLst {
		if !chat.Is_group {
			exists, err := redis.RedisClient.SIsMember(redis.Ctx, "online_users", chat.OtherUserID).Result()
			if err != nil {
				chatsLst[i].IsOnline = false
				log.Printf("failed to check is user online /GetChatsForHP\nerror:%v", err)
				continue
			}
			chatsLst[i].IsOnline = exists
		}
	}
	log.Printf("successful getChatsOnHomePage")
	return chatsLst, nil
}
