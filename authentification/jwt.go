package authentification

import (
	"context"
	"fmt"
	"log"
	models "mess/models/services/jwt"
	"mess/services"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
)

var Secret = []byte(os.Getenv("JWT_SECRET"))

func initEnv() {
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not loaded")
	}
}

func CreateJwt(uid uint) (string, error) {
	initEnv()
	expireHours, err := strconv.Atoi(os.Getenv("JWT_EXPIRE_HOURS"))

	if err != nil {
		log.Printf("failed to get expire ours,error:%v", err)
	}
	claims := models.JWTClaims{
		UserID: uid,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour * time.Duration(expireHours))),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(Secret)
}

func JWTMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tokenString, err := checkJWT4Middleware(r) //check token valid
		if err != nil {
			mess := "failed to check JWT"
			services.ResponseFunc(w, http.StatusUnauthorized, mess, nil)
			return
		}
		token, err := JWTVerification(tokenString) //get payload from jwt

		if err != nil || !token.Valid {
			mess := "invalid JWT"
			log.Printf("invalid JWT,error:%v", err)
			services.ResponseFunc(w, http.StatusUnauthorized, mess, nil)
			return
		}

		claims, ok := token.Claims.(*models.JWTClaims)
		if !ok {
			mess := "invalid token values"
			services.ResponseFunc(w, http.StatusUnauthorized, mess, nil)
			return
		}
		ctx := context.WithValue(r.Context(), models.UserIDKey, claims.UserID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func JWTVerification(tokenString string) (*jwt.Token, error) {
	token, err := jwt.ParseWithClaims(tokenString, &models.JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		return Secret, nil
	})
	return token, err
}

func checkJWT4Middleware(r *http.Request) (string, error) {
	tokenString := r.Header.Get("Authorization")
	if tokenString == "" {
		return "", fmt.Errorf("token is not provided /check4jwtmiddleware")
	}
	if strings.HasPrefix(tokenString, "Bearer ") {
		tokenString = strings.TrimPrefix(tokenString, "Bearer ")
		tokenString = strings.TrimSpace(tokenString)
	} else {
		return "", fmt.Errorf("token provide is incorrect /check4jwtmiddleware")
	}
	return tokenString, nil
}

// check is valid token from url
func CheckJWTFromURL(r *http.Request) bool {
	tokenString := r.Header.Get("token")
	if tokenString == "" {
		return false
	}
	token, err := jwt.ParseWithClaims(tokenString, &models.JWTClaims{}, func(t *jwt.Token) (interface{}, error) { return Secret, nil })

	if err != nil || !token.Valid {
		log.Println("invalid token /CheckJWT")
		return false
	}
	return true
}

// user ID from request body
func GetUserID(r *http.Request) (int, error) {
	ctxUID := r.Context().Value(models.UserIDKey)
	if ctxUID == nil {
		return -1, fmt.Errorf("userID not found in r.Context")
	}
	switch v := ctxUID.(type) {
	case uint:
		return int(v), nil
	case int:
		return v, nil
	default:
		return -1, fmt.Errorf("inbalid type of UserID")
	}
}

// get userID from TOKEN
func GetUserIDFromToken(tokenStr string) (uint, error) {
	token, err := JWTVerification(tokenStr)
	if err != nil {
		return 0, err
	}
	if claims, ok := token.Claims.(*models.JWTClaims); ok && token.Valid {
		return claims.UserID, nil
	}
	return 0, fmt.Errorf("invalid token")
}
