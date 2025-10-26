package profile

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"mess/database"
	chatsModels "mess/models/chatsModels"
	profileModels "mess/models/profileModels"
	JWTModels "mess/models/services/jwt"
	"mess/redis"
	"mess/services"
	"net/http"
	"slices"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var activeSubs sync.Map
var activeProfileViewers sync.Map

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func OpenProfileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		log.Printf("method not allowed")
		services.MethodNotAllowed(w, r)
		return
	}
	var profileRequest profileModels.ProfileRequest
	if err := services.DecodeRequest(w, r, &profileRequest); err != nil {
		log.Printf("failed to decode request,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to decode request", nil)
		return
	}
	log.Printf("🔍 OpenProfileHandler: chatID=%d, isGroup=%v", profileRequest.ID, profileRequest.IsGroup)

	allOnline, err := redis.RedisClient.SMembers(redis.Ctx, "online:users").Result()
	if err != nil {
		log.Printf("❌ Ошибка получения онлайн пользователей: %v", err)
	} else {
		log.Printf("📊 Все онлайн пользователи: %v", allOnline)
	}

	profileRedis, err := getProfileFromRedis(profileRequest.ID)
	if err == nil {
		log.Printf("OpenProfileHandler: successful get profile from redis")
		for i, user := range profileRedis.Members {
			log.Printf("🔵 Пользователь %d", user.ID)
			exists, err := redis.RedisClient.SIsMember(redis.Ctx, "online:users", user.ID).Result()
			log.Printf("🔵 Пользователь %v", exists)
			if err != nil {
				services.ResponseFunc(w, http.StatusInternalServerError, "failed to get online users", nil)
				return
			}
			if exists {
				log.Printf("🔵 Пользователь %d онлайн", user.ID)
				profileRedis.Members[i].IsOnline = true
			} else {
				log.Printf("🔵 Пользователь %d не онлайн", user.ID)
				profileRedis.Members[i].IsOnline = false
			}
		}
		services.ResponseFunc(w, http.StatusOK, "successful get profile", profileRedis)
		for _, user := range profileRedis.Members {
			log.Printf("🟢 Пользователь %d | Онлайн: %v", user.ID, user.IsOnline)
		}
		return
	}

	log.Printf("failed to get profile from redis,error:%v", err)
	var profile profileModels.Profile
	if profileRequest.IsGroup {
		profile, err = database.GetGroupProfile(chatsModels.Chat{ID: profileRequest.ID, Is_group: true})
		profile.IsGroup = true
	} else {
		profile, err = database.GetUserProfile(profileRequest.ID)
		profile.IsGroup = false
	}
	if err != nil {
		log.Printf("failed to get profile from db,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to get profile", nil)
		return
	}

	for i, user := range profile.Members {
		exists, err := redis.RedisClient.SIsMember(redis.Ctx, "online:users", user.ID).Result()
		if err != nil {
			services.ResponseFunc(w, http.StatusInternalServerError, "failed to get online users", nil)
			return
		}
		if exists {
			log.Printf("🔵 Пользователь %d онлайн", user.ID)
			profile.Members[i].IsOnline = true
		} else {
			log.Printf("🔵 Пользователь %d офлайн", user.ID)
			profile.Members[i].IsOnline = false
		}
	}
	if err := saveProfileToRedis(profile, profileRequest.ID); err != nil {
		log.Printf("failed to save profile to redis,error:%v", err)
	}
	for _, user := range profile.Members {
		log.Printf("🟢 Пользователь %d | Онлайн: %v", user.ID, user.IsOnline)
	}
	services.ResponseFunc(w, http.StatusOK, "successful", profile)
}

func ProfileWSHandler(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	userIDStr := r.Context().Value(JWTModels.UserIDKey)

	if userID, ok := userIDStr.(uint); ok {
		chatIDStr := r.URL.Query().Get("chat_id")
		chatID, err := strconv.Atoi(chatIDStr)
		if err != nil {
			log.Printf("invalid chat id: %v", err)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("failed to upgrade connection: %v", err)
			return
		}

		if err := addViewer(chatID, int(userID), ctx); err != nil {
			log.Printf("failed to add viewer: %v", err)
			conn.Close()
			return
		}

		defer func() {
			removeViewer(chatID, int(userID))
			conn.Close()
		}()

		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
	} else {
		log.Printf("invalid userID in context")
	}
}

func addViewer(chatID, userID int, ctx context.Context) error {
	viewers, _ := activeProfileViewers.LoadOrStore(chatID, &sync.Map{})
	viewersMap := viewers.(*sync.Map)

	wasEmpty := true
	viewersMap.Range(func(_, _ any) bool {
		wasEmpty = false
		return false
	})
	viewersMap.Store(userID, true)

	if wasEmpty {
		log.Printf("no viewers for chat %d", chatID)

		chat, err := database.GetChatByID(chatID)
		if err != nil {
			log.Printf("failed to get chat by id,error:%v", err)
			return err
		}
		if chat.Is_group {
			profile, err := database.GetGroupProfile(chat)
			if err != nil {
				log.Printf("failed to get profile group,err:%v", err)
				return err
			}
			var userIDs []string
			for _, user := range profile.Members {
				userIDs = append(userIDs, strconv.Itoa(int(user.ID)))
			}
			ProfileChannelSubscribe(ctx, "online:status", chatID, "profile:update", userIDs, profile, &activeSubs)
		} else {
			profile, err := database.GetUserProfile(chat.OtherUserID)
			if err != nil {
				log.Printf("failed to get user profile,error:%v", err)
				return err
			}
			userIDs := []string{strconv.Itoa(chat.OtherUserID)}
			ProfileChannelSubscribe(ctx, "online:status", chatID, "profile:update", userIDs, profile, &activeSubs)
		}
	}
	return nil
}

func removeViewer(chatID, userID int) error {
	viewers, _ := activeProfileViewers.LoadOrStore(chatID, &sync.Map{})
	viewersMap := viewers.(*sync.Map)
	viewersMap.Delete(userID)
	isEmpty := true
	viewersMap.Range(func(_, _ any) bool {
		isEmpty = false
		return false
	})
	if isEmpty {
		activeProfileViewers.Delete(chatID)
	}
	return nil
}

func MyProfileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		services.MethodNotAllowed(w, r)
		return
	}

	userID := r.Context().Value(JWTModels.UserIDKey).(uint)
	u, err := database.GetMyProfileHP(int(userID))
	if err != nil {
		log.Printf("%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed get user profile", nil)
		return
	}
	services.ResponseFunc(w, http.StatusOK, "successful get profile", u)
}

func ProfileChannelSubscribe(ctx context.Context, key string, chatID int, typeMessage string, userIDs []string, profile profileModels.Profile, activeSubs *sync.Map) {
	log.Printf("🔔 ProfileChannelSubscribe: chatID=%d, key=%s, userIDs=%v", chatID, key, userIDs)
	if _, loaded := activeSubs.Load(chatID); loaded {
		return
	}
	go func() {
		subCtx, cancel := context.WithCancel(ctx)
		activeSubs.Store(chatID, cancel)
		pubSub := redis.RedisClient.Subscribe(redis.Ctx, fmt.Sprintf(key+":%d", chatID))

		defer func() {
			pubSub.Close()
			activeSubs.Delete(chatID)
		}()
		for {
			var profileCopy profileModels.Profile
			select {
			case <-subCtx.Done():
				return
			case _, ok := <-pubSub.Channel():
				if !ok {
					return
				}
				exists, err := redis.RedisClient.SInter(redis.Ctx, append([]string{"online:users"}, userIDs...)...).Result()
				if err != nil {
					log.Printf("failed to check is user online /responseProfile\nerror:%v", err)
					continue
				}
				profileCopy = profile
				if profileCopy.IsGroup {
					for i := range profileCopy.Members {
						userID := strconv.Itoa(int(profileCopy.Members[i].ID))
						if slices.Contains(exists, userID) {
							profileCopy.Members[i].IsOnline = true
						} else {
							profileCopy.Members[i].IsOnline = false
						}
					}
				} else {
					profileCopy.IsOnline = slices.Contains(exists, userIDs[0])
				}
				message := chatsModels.Message{
					Type:      typeMessage, // ← фронт поймет что это не текст
					ChatId:    chatID,
					Content:   profileCopy,
					CreatedAt: time.Now(),
				}
				services.BroadcastToRoom(message, chatID)
			}
		}
	}()
}

func saveProfileToRedis(profile profileModels.Profile, chatID int) error {
	profileJSON, err := json.Marshal(profile)
	if err != nil {
		return err
	}
	if err := redis.RedisClient.Set(redis.Ctx, fmt.Sprintf("profile:%d", chatID), profileJSON, 1*time.Minute).Err(); err != nil {
		return err
	}
	return nil
}

func getProfileFromRedis(chatID int) (profileModels.Profile, error) {
	var profile profileModels.Profile
	profileJSON, err := redis.RedisClient.Get(redis.Ctx, fmt.Sprintf("profile:%d", chatID)).Result()
	if err != nil {
		return profile, err
	}

	if err := json.Unmarshal([]byte(profileJSON), &profile); err != nil {
		return profile, err
	}
	return profile, nil
}
