package redis

import (
	"context"
	"log"

	"github.com/redis/go-redis/v9"
)

var (
	Ctx         = context.Background()
	RedisClient *redis.Client
)

func InitRedis() error {
	RedisClient = redis.NewClient(&redis.Options{
		Addr:     "redis:6379",
		Password: "",
		DB:       0,
	})

	_, err := RedisClient.Ping(Ctx).Result()
	if err != nil {
		log.Fatalf("Failed to connect redis: %v", err)
		return err
	}

	log.Println("✅ Redis successful conntected")
	return nil
}
