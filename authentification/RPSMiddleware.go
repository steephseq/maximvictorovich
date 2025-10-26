package authentification

import (
	"fmt"
	JWTModels "mess/models/services/jwt"
	"mess/redis"
	"mess/services"
	"net/http"
	"strings"
)

func RPSCountMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		publicRoutes := []string{"/register", "/login", "/", "/ws"}
		for _, route := range publicRoutes {
			if r.URL.Path == route {
				next.ServeHTTP(w, r)
				return
			}
		}
		var key string
		userIDStr := r.Context().Value(JWTModels.UserIDKey)
		if userIDStr != nil {
			userID, ok := userIDStr.(int)
			if !ok {
				services.ResponseFunc(w, http.StatusUnauthorized, "failed to parse userID", nil)
				return
			}
			key = fmt.Sprintf("user:request:%d", userID)
		} else {
			ip := getIP(r)
			key = fmt.Sprintf("ip:request:%s", ip)
		}
		result, err := redis.RedisClient.Do(redis.Ctx, "CL.THROTTLE", key, 10, 10, 1).Result()
		if err != nil {
			services.ResponseFunc(w, http.StatusInternalServerError, "failed to execute redis command", nil)
			return
		}
		response, ok := result.([]interface{})
		if !ok {
			services.ResponseFunc(w, http.StatusInternalServerError, "failed to parse redis response", nil)
			return
		}
		allowed, ok := response[0].(int64)
		if !ok {
			services.ResponseFunc(w, http.StatusInternalServerError, "failed to parse redis response", nil)
			return
		}
		if allowed == 1 {
			services.ResponseFunc(w, http.StatusTooManyRequests, "too many requests", nil)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func getIP(r *http.Request) string {
	forwared := r.Header.Get("X-Forwarded-For")
	if forwared != "" {
		ips := strings.Split(forwared, ",")
		return strings.TrimSpace(ips[0])
	}
	return r.RemoteAddr
}
