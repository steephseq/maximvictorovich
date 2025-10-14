package services

import "mess/redis"

func IsUserOnline(userID int) (bool, error) {
	exists, err := redis.RedisClient.SIsMember(redis.Ctx, "online_users", userID).Result()
	if err != nil {
		return false, err
	}
	return exists, nil
}
