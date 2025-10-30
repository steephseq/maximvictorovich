package chats

import (
	"log"
	"mess/services"
	"net/http"
)

func ShowChatsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-type", "application/json")
	if r.Method != http.MethodGet {
		log.Printf("method not allowed")
		services.ResponseFunc(w, http.StatusMethodNotAllowed, "method not allowed", nil)
		return
	}
	chats, err := GetChatsForHP(r)
	if err != nil {
		log.Printf("failed to get chats for hp,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to get chats", nil)
		return
	}

	services.ResponseFunc(w, http.StatusOK, "successful get chats", chats)
}

/*func ShowChatsWSHandler(w http.ResponseWriter, r *http.Request) {
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
	}
}

func GetChatsWSHandler(w http.ResponseWriter, r *http.Request) {
	userIDAnd:=r.Context().Value(JWTModels.UserIDKey)
	userID,ok:=userIDAnd.(uint)
	if !ok{
		log.Printf("failed to get user id")
		services.ResponseFunc(w, http.StatusUnauthorized, "failed to get user id", nil)
		return
	}
	chatsChannelSubscribe(context.Background(),"",int(userID))
}

func chatsChannelSubscribe(ctx context.Context, key string,userID int) error {
	go func() {
		subCtx, cancel := context.WithCancel(ctx)
		defer cancel()
		channelName := fmt.Sprintf(key+":%d", chatID)
		pubSub := redis.RedisClient.Subscribe(redis.Ctx, channelName)

		log.Printf("📡 Подписались на Redis канал: %s", channelName)

		defer func() {
			pubSub.Close()
			log.Printf("📡 Отписались от Redis канала: %s", channelName)
		}()

		for {
			var profileCopy profileModels.Profile
			select {
			case <-subCtx.Done():
				return
			case msg, ok := <-pubSub.Channel():
				if !ok {
					return
				}
				exists,err

			}
		}
	}()
}*/
