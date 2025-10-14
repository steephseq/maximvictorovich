package redis

import (
	"log"
	"time"
)

func RedisExpire(key string, timeExpire time.Duration) error {
	if err := RedisClient.Expire(Ctx, key, timeExpire).Err(); err != nil {
		log.Printf("failed to expire %s, error:%v", key, err)
		return err
	}
	return nil
}

func RedisHSet(key string, fields map[string]interface{}) error {
	if err := RedisClient.HSet(Ctx, key, fields).Err(); err != nil {
		log.Printf("failed to add to set %s, error:%v", key, err)
		return err
	}
	return nil
}

func RedisSAdd(key string, value interface{}) error {
	if err := RedisClient.SAdd(Ctx, key, value).Err(); err != nil {
		log.Printf("failed to add user to online set, error:%v", err)
		return err
	}
	return nil
}

func RedisSRem(key string, value interface{}) error {
	if err := RedisClient.SRem(Ctx, key, value).Err(); err != nil {
		log.Printf("failed to remove from %s, error:%v", key, err)
		return err
	}
	return nil
}
