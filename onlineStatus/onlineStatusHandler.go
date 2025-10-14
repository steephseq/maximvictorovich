package onlineStatus

import (
	"context"
	"fmt"
	"log"
	"mess/database"
	JWTModels "mess/models/services/jwt"
	"mess/redis"
	"mess/services"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func OnlineStatusHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("online status handler")
	userIDStr := r.Context().Value(JWTModels.UserIDKey)
	userID, ok := userIDStr.(uint)
	if !ok {
		services.ResponseFunc(w, http.StatusUnauthorized, "invalid token", nil)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("failed to upgrade ws, error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to upgrade ws", nil)
		return
	}
	log.Printf("ws connection is successfully")
	defer conn.Close()

	if err := AddUserOnline(userID); err != nil {
		log.Printf("failed to add user to online set, error:%v", err)
	}
	if err := AddToOnlineChats(int(userID)); err != nil {
		log.Printf("failed to add user to online chats, error:%v", err)
	}
	if err := SendMessageToChatsChannels("chat_event", int(userID), "user_online"); err != nil {
		log.Printf("failed to send message to chats channels: %v", err)
	}
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			log.Printf("failed to read message, error:%v", err)
			DeleteUserFromOnline(int(userID))
			DeleteUserFromOnlineChats(int(userID))
			if err := database.UpdateLastSeen(int(userID), time.Now().UTC()); err != nil {
				log.Printf("failed to update last seen, error:%v", err)
			}
			log.Printf("user %d is offline", userID)
			break
		}

		if string(msg) == "ping" {
			if err := UpdateOnlineStatus(int(userID)); err != nil {
				log.Printf("failed to update online status, error:%v", err)
			}
			continue
		}
	}

}

func AddUserOnline(userID uint) error {
	if err := redis.RedisSAdd("online_users", userID); err != nil {
		return err
	}

	fields := map[string]interface{}{
		"user_id":   userID,
		"last_seen": time.Now().UTC().Format(time.RFC3339),
	}
	key := fmt.Sprintf("user:%d:status", userID)
	if err := redis.RedisHSet(key, fields); err != nil {
		return err
	}

	if err := redis.RedisExpire(key, 10*time.Minute); err != nil {
		return err
	}

	key = fmt.Sprintf("user:%d:active", userID)
	if err := redis.RedisHSet(key, map[string]interface{}{"active": true}); err != nil {
		return err
	}
	if err := redis.RedisExpire(key, 10*time.Second); err != nil {
		return err
	}

	return nil
}

func AddToOnlineChats(userID int) error {
	allChats, err := database.GetChatsByUserID(userID)
	if err != nil {
		return err
	}
	for _, chat := range allChats {
		if err := redis.RedisSAdd(fmt.Sprintf("chat_online_users:%d", chat.ID), userID); err != nil {
			return err
		}
	}
	return nil
}

func DeleteUserFromOnlineChats(userID int) error {
	allChats, err := database.GetChatsByUserID(userID)
	if err != nil {
		return err
	}
	for _, chat := range allChats {
		if err := redis.RedisSRem(fmt.Sprintf("chat_online_users:%d", chat.ID), userID); err != nil {
			return err
		}
	}
	return nil
}

func DeleteUserFromOnline(userID int) error {
	if err := redis.RedisClient.SRem(redis.Ctx, "online_users", userID).Err(); err != nil {
		return err
	}
	key := fmt.Sprintf("user:%d:status", userID)
	if err := redis.RedisClient.HSet(redis.Ctx, key, "online", false).Err(); err != nil {
		return err
	}
	key = fmt.Sprintf("user:%d:active", userID)
	if err := redis.RedisClient.Del(redis.Ctx, key).Err(); err != nil {
		return err
	}
	return nil
}

func OnlineWorker(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			userIDs, err := redis.RedisClient.SMembers(ctx, "online_users").Result()
			if err != nil {
				log.Printf("failed to get online users, error:%v", err)
				continue
			}
			for _, idStr := range userIDs {
				select {
				case <-ctx.Done():
					return
				default:
				}
				id, err := strconv.Atoi(idStr)
				if err != nil {
					log.Printf("failed to parse id to int /onlineUsers ,error:%v", err)
					continue
				}
				key := fmt.Sprintf("user:%d:active", id)
				exists, _ := redis.RedisClient.Exists(ctx, key).Result()
				if exists == 0 {
					if err := redis.RedisClient.SRem(ctx, "online_users", id).Err(); err != nil {
						log.Printf("failed to remove user from online set, error:%v", err)
						continue
					}
					statusKey := fmt.Sprintf("user:%d:status", id)
					if err := redis.RedisClient.HSet(ctx, statusKey,
						"online", false,
						"last_seen", time.Now().UTC().Format(time.RFC3339)).Err(); err != nil {
						log.Printf("failed to set user last seen, error:%v", err)
						continue
					}
				}
			}
		}
	}
}

func UpdateOnlineStatus(userID int) error {
	key := fmt.Sprintf("user:%d:status", userID)
	if err := redis.RedisExpire(key, 10*time.Minute); err != nil {
		return err
	}
	if err := redis.RedisHSet(key, map[string]interface{}{"last_seen": time.Now().UTC().Format(time.RFC3339)}); err != nil {
		return err
	}

	key = fmt.Sprintf("user:%d:active", userID)
	if err := redis.RedisExpire(key, 10*time.Second); err != nil {
		return err
	}
	return nil
}

func RedisExpireWorker(ctx context.Context) {
	pubsub := redis.RedisClient.PSubscribe(ctx, "__keyevent@0__:expired")

	defer pubsub.Close()
	for {
		select {
		case <-ctx.Done():
			return

		case msg := <-pubsub.Channel():
			if strings.Contains(msg.Payload, "active") {
				parts := strings.Split(msg.Payload, ":")
				if len(parts) != 3 {
					log.Printf("invalid key %s", msg.Payload)
					continue
				}
				idStr := parts[1]
				id, err := strconv.Atoi(idStr)
				if err != nil {
					log.Printf("failed to parse id to int /onlineStatus \nerror:%v", err)
				}

				key := fmt.Sprintf("user:%d:status", id)
				lastSeenStr, err := redis.RedisClient.HGet(ctx, key, "last_seen").Result()
				if err != nil {
					log.Printf("failed to get last seen, /onlineStatus \nerror:%v", err)
					continue
				}
				lastSeen, err := time.Parse(time.RFC3339, lastSeenStr)
				if err != nil {
					log.Printf("failed to parse last seen, /onlineStatus \nerror:%v", err)
					continue
				}
				if err := database.UpdateLastSeen(id, lastSeen); err != nil {
					log.Printf("failed to update last seen /onlineStatus \nerror:%v", err)
					continue
				}
			}
		}
	}
}
