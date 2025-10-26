package redis

import (
	"fmt"
)

func CalculateOnlineUsers(chatID int) (int, error) {
	onlineCount, err := RedisClient.SCard(Ctx, fmt.Sprintf("chat:online:users:%d", chatID)).Result()
	if err != nil {
		return 0, err
	}
	return int(onlineCount), nil
}
