package profile

import (
	"context"
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
	"time"
)

func OpenProfile(w http.ResponseWriter, r *http.Request) {
	log.Println("open profile triggered")
	if r.Method != http.MethodPost {
		services.MethodNotAllowed(w, r)
		return
	}

	var profileOBJRequest chatsModels.Chat
	if err := services.DecodeRequest(w, r, &profileOBJRequest); err != nil {
		return
	}
	resultProfile, err := responseProfile(profileOBJRequest, r)
	if err != nil {
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to get profile", nil)
		return
	}
	services.ResponseFunc(w, http.StatusOK, "successful get profile", resultProfile)
}

func responseProfile(profileOBJRequest chatsModels.Chat, r *http.Request) (profileModels.Profile, error) {
	var profile profileModels.Profile
	if profileOBJRequest.Is_group {
		profile, err := database.GetGroupProfile(profileOBJRequest)
		if err != nil {
			log.Printf("failed to get group profile for update, error:%v", err)
			return profile, err
		}
		var userIDs []string
		for _, user := range profile.Members {
			userIDs = append(userIDs, strconv.Itoa(int(user.ID)))
		}
		exists, err := redis.RedisClient.SInter(
			redis.Ctx,
			append([]string{"online_users"}, userIDs...)...).Result()
		if err != nil {
			log.Printf("failed to get online members, error:%v", err)
			return profile, err
		}
		for i, user := range profile.Members {
			if slices.Contains(exists, strconv.Itoa(int(user.ID))) {
				profile.Members[i].IsOnline = true
			} else {
				profile.Members[i].IsOnline = false
			}
		}
		return profile, err
	} else {
		userIDuint := r.Context().Value(JWTModels.UserIDKey)
		userID, ok := userIDuint.(uint)
		if !ok {
			return profile, fmt.Errorf("failed to get user id")
		}
		uid, err := database.GetAnotherUserForProfile(profileOBJRequest.ID, int(userID))
		if err != nil {
			return profile, err
		}
		profile, err = database.GetUserProfile(uid)
		if err != nil {
			log.Println(err)
			if err == fmt.Errorf("user not found") {
				profile.Name = "Deleted Account"
			} else {
				return profile, err
			}
		}
		exists, err := redis.RedisClient.SIsMember(redis.Ctx, "online_users", uid).Result()
		if err != nil {
			profile.IsOnline = false
			return profile, err
		}
		profile.IsOnline = exists
		return profile, nil
	}
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

func ProfileChannelSubscribe(ctx context.Context, key string, chatID int, typeMessage string, userIDs []string, groupProfile *profileModels.Profile) {
	pubSub := redis.RedisClient.Subscribe(redis.Ctx, fmt.Sprintf(key+":%d", chatID))
	go func() {
		defer pubSub.Close()
		for {
			select {
			case <-ctx.Done():
				return
			case _, ok := <-pubSub.Channel():
				if !ok {
					return
				}
				exists, err := redis.RedisClient.SInter(redis.Ctx, append([]string{"online_users"}, userIDs...)...).Result()
				if err != nil {
					log.Printf("failed to check is user online /responseProfile\nerror:%v", err)
					continue
				}
				profileCopy := *groupProfile
				for i := range profileCopy.Members {
					if slices.Contains(exists, strconv.Itoa(int(profileCopy.Members[i].ID))) {
						profileCopy.Members[i].IsOnline = true
					} else {
						profileCopy.Members[i].IsOnline = false
					}
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
