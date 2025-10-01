package chats

import (
	"fmt"
	"log"
	"mess/database"
	chatsModels "mess/models/chatsModels"
	models "mess/models/services/jwt"
	"net/http"
)

// func for get chats on home page
func GetChatsForHP(r *http.Request) ([]chatsModels.Chat, error) {
	if r.Method != http.MethodGet {
		log.Printf("method not allowed from GetChatsForHP")
		return nil, fmt.Errorf("error:%s", "method not allowed")
	}

	userID := r.Context().Value(models.UserIDKey).(uint)

	chatsLst, err := database.GetChatsOnHomePage(int(userID))
	if err != nil {
		log.Printf("failed to Get chats for home page,error:%v", err)
		return nil, err
	}

	log.Printf("successful getChatsOnHomePage")
	return chatsLst, nil
}
