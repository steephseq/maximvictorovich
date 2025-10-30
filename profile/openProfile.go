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

	userIDAny := r.Context().Value(JWTModels.UserIDKey)
	userID, ok := userIDAny.(uint)
	if !ok {
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to get profile", nil)
		return
	}
	profileRedis, err1 := getProfileFromRedis(profileRequest.ID, int(userID))
	if err1 == nil {
		log.Printf("OpenProfileHandler: successful get profile from redis")
		for i, user := range profileRedis.Members {
			exists, err := redis.RedisClient.SIsMember(redis.Ctx, "online:users", user.ID).Result()
			log.Printf("🔵 Пользователь %v", exists)
			if err != nil {
				services.ResponseFunc(w, http.StatusInternalServerError, "failed to get online users", nil)
				return
			}
			if exists {
				profileRedis.Members[i].IsOnline = true
			} else {
				profileRedis.Members[i].IsOnline = false
			}
		}
		services.ResponseFunc(w, http.StatusOK, "successful get profile", profileRedis)
		return
	}

	log.Printf("failed to get profile from redis,error:%v", err1)
	var profile profileModels.Profile
	if profileRequest.IsGroup {
		profile, err = database.GetGroupProfile(chatsModels.Chat{ID: profileRequest.ID, Is_group: true})
		if err != nil {
			log.Printf("failed to get group profile,error:%v", err)
			services.ResponseFunc(w, http.StatusInternalServerError, "failed to get profile", nil)
			return
		}
	} else {
		userIDAnother, err := database.GetAnotherUserForProfile(profileRequest.ID, int(userID))
		log.Printf("userIDAnother: %d", userIDAnother)
		if err != nil {
			log.Printf("failed to get another user for profile,error:%v", err)
			services.ResponseFunc(w, http.StatusInternalServerError, "failed to get profile", nil)
			return
		}
		profile, err = database.GetUserProfile(userIDAnother)
		if err != nil {
			log.Printf("failed to get user profile,error:%v", err)
			services.ResponseFunc(w, http.StatusInternalServerError, "failed to get profile", nil)
			return
		}
	}

	profile.AvatarURL = services.GetAvatarURL(profile.AvatarURL)
	for i, user := range profile.Members {
		exists, err := redis.RedisClient.SIsMember(redis.Ctx, "online:users", user.ID).Result()
		if err != nil {
			services.ResponseFunc(w, http.StatusInternalServerError, "failed to get online users", nil)
			return
		}
		url := services.GetAvatarURL(user.Avatar)
		profile.Members[i].Avatar = url
		if exists {
			profile.Members[i].IsOnline = true
		} else {
			profile.Members[i].IsOnline = false
		}
	}
	if err := saveProfileToRedis(profile, profileRequest.ID, int(userID)); err != nil {
		log.Printf("failed to save profile to redis,error:%v", err)
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

	log.Printf("👀 addViewer: chatID=%d, userID=%d, wasEmpty=%v", chatID, userID, wasEmpty)

	if wasEmpty {
		log.Printf("🟢 ПЕРВЫЙ зритель для чата %d, подписываемся на статусы", chatID)

		chat, err := database.GetChatByID(chatID)
		if err != nil {
			log.Printf("❌ failed to get chat by id: %v", err)
			return err
		}

		log.Printf("📋 Информация о чате: ID=%d, IsGroup=%v, OtherUserID=%d",
			chat.ID, chat.Is_group, chat.OtherUserID)

		if chat.Is_group {
			profile, err := database.GetGroupProfile(chat)
			if err != nil {
				log.Printf("❌ failed to get group profile: %v", err)
				return err
			}
			ProfileChannelSubscribe(ctx, "online:status", chatID, "profile:update", profile, &activeSubs)
		} else {
			profile, err := database.GetUserProfile(chat.OtherUserID)
			if err != nil {
				log.Printf("❌ failed to get user profile: %v", err)
				return err
			}
			ProfileChannelSubscribe(ctx, "online:status", chatID, "profile:update", profile, &activeSubs)
		}
	} else {
		log.Printf("🔵 НЕ первый зритель для чата %d, подписка уже должна быть", chatID)
		if _, exists := activeSubs.Load(chatID); exists {
			log.Printf("✅ Подписка для чата %d АКТИВНА", chatID)
		} else {
			log.Printf("❌ Подписка для чата %d ОТСУТСТВУЕТ (ЭТО ПРОБЛЕМА!)", chatID)
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

	url := services.GetAvatarURL(u.AvatarURL)
	log.Println("MyProfileHandler:", url)
	u.AvatarURL = url
	services.ResponseFunc(w, http.StatusOK, "successful get profile", u)
}

func ProfileChannelSubscribe(ctx context.Context, key string, chatID int, typeMessage string, profile profileModels.Profile, activeSubs *sync.Map) {
	log.Printf("🔔 ProfileChannelSubscribe: chatID=%d, key=%s, membersCount=%d",
		chatID, key, len(profile.Members))

	if _, loaded := activeSubs.Load(chatID); loaded {
		log.Printf("⚠️ Уже подписаны на чат %d, пропускаем дублирование", chatID)
		return
	}

	log.Printf("🟡 СОЗДАЕМ ПОДПИСКУ для чата %d", chatID)

	go func() {
		subCtx, cancel := context.WithCancel(ctx)
		activeSubs.Store(chatID, cancel)
		channelName := fmt.Sprintf(key+":%d", chatID)
		pubSub := redis.RedisClient.Subscribe(redis.Ctx, channelName)

		log.Printf("📡 Подписались на Redis канал: %s", channelName)

		defer func() {
			pubSub.Close()
			activeSubs.Delete(chatID)
			log.Printf("📡 Отписались от Redis канала: %s", channelName)
		}()

		for {
			var profileCopy profileModels.Profile
			select {
			case <-subCtx.Done():
				log.Printf("📡 Контекст отменен для чата %d", chatID)
				return
			case msg, ok := <-pubSub.Channel():
				if !ok {
					log.Printf("📡 Канал закрыт для чата %d", chatID)
					return
				}
				log.Printf("📨 Получено сообщение из Redis для чата %d: %s", chatID, msg.Payload)

				profileCopy = profile
				if profileCopy.IsGroup {
					for i := range profileCopy.Members {
						exists, err := redis.RedisClient.SIsMember(redis.Ctx, "online:users", strconv.Itoa(int(profileCopy.Members[i].ID))).Result()
						if err != nil {
							log.Printf("❌ Ошибка проверки онлайн статусов: %v", err)
							continue
						}
						profileCopy.Members[i].IsOnline = exists
					}
				} else {
					if len(profileCopy.Members) > 0 {
						exists, err := redis.RedisClient.SIsMember(redis.Ctx, "online:users", strconv.Itoa(int(profileCopy.Members[0].ID))).Result()
						if err != nil {
							log.Printf("❌ Ошибка проверки онлайн статусов: %v", err)

						} else {
							profileCopy.IsOnline = exists
						}
					} else {
						log.Println("❌ Ошибка проверки онлайн статусов: профиль без участников")
					}
				}
				profileJSON, err := json.Marshal(profileCopy)
				if err != nil {
					log.Printf("❌ Failed to marshal profile to JSON: %v", err)
					return
				}
				message := chatsModels.Message{
					Type:      typeMessage,
					ChatId:    chatID,
					Content:   string(profileJSON),
					CreatedAt: time.Now(),
				}
				log.Printf("📤 Отправляем обновление профиля для чата %d", chatID)
				services.BroadcastToRoom(message, chatID)
			}
		}
	}()
}

func saveProfileToRedis(profile profileModels.Profile, chatID int, userID int) error {
	profileJSON, err := json.Marshal(profile)
	if err != nil {
		return err
	}
	if err := redis.RedisClient.Set(redis.Ctx, fmt.Sprintf("profile:%d:viewer:%d", chatID, userID), profileJSON, 1*time.Minute).Err(); err != nil {
		return err
	}
	return nil
}

func getProfileFromRedis(chatID int, userID int) (profileModels.Profile, error) {
	var profile profileModels.Profile
	profileJSON, err := redis.RedisClient.Get(redis.Ctx, fmt.Sprintf("profile:%d:viewer:%d", chatID, userID)).Result()
	if err != nil {
		return profile, err
	}

	if err := json.Unmarshal([]byte(profileJSON), &profile); err != nil {
		return profile, err
	}
	return profile, nil
}
