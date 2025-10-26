package verification

import (
	"crypto/rand"
	"errors"
	"fmt"
	"log"
	"math/big"
	verificationModels "mess/models/verificationModels"
	"mess/redis"
	"os"
	"strconv"
	"time"

	"gopkg.in/gomail.v2"
)

func GenerateVerificationCode() (string, error) {
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n), nil
}

func NewVerificationService() *verificationModels.VerificationService {
	return &verificationModels.VerificationService{
		EmailDialer: gomail.NewDialer("smtp.yandex.ru", 465, getEnv("MAIL"), getEnv("MAIL_PASSWORD")),
		FromEmail:   getEnv("MAIL"),
	}
}

func StoreCode(email, code string, expiraion time.Duration) error {
	if err := redis.RedisClient.Set(redis.Ctx, fmt.Sprintf("verification:%s", email), code, expiraion).Err(); err != nil {
		log.Printf("Verification: failed to store code for email %s: %v", email, err)
		return err
	}
	if err := redis.RedisClient.Set(redis.Ctx, fmt.Sprintf("attempts:%s", email), 0, expiraion).Err(); err != nil {
		log.Printf("Verification: failed to store attempts for email %s: %v", email, err)
		return err
	}
	return nil
}

func VerifyCode(email, code string) (bool, error) {
	storedCode, err := redis.RedisClient.Get(redis.Ctx, fmt.Sprintf("verification:%s", email)).Result()
	if storedCode == "" {
		err = errors.New("code not found")
		return false, err
	}
	if err != nil {
		log.Printf("Verification: failed to get code for email %s: %v", email, err)
		return false, err
	}

	attemptsStr, err := redis.RedisClient.Get(redis.Ctx, fmt.Sprintf("attempts:%s", email)).Result()
	if err != nil {
		log.Printf("Verification: failed to get attempts for email %s: %v", email, err)
		return false, err
	}
	attempts, err := strconv.Atoi(attemptsStr)
	if err != nil {
		log.Printf("Verification: failed to convert attempts for email %s: %v", email, err)
		return false, err
	}
	if attempts >= 3 {
		if err := redis.RedisClient.Del(redis.Ctx, fmt.Sprintf("verification:%s", email), fmt.Sprintf("attempts:%s", email)).Err(); err != nil {
			log.Printf("Verification: failed to delete code and attempts for email %s: %v", email, err)
			return false, err
		}
		return false, errors.New("too many attempts")
	}
	if err := redis.RedisClient.Incr(redis.Ctx, fmt.Sprintf("attempts:%s", email)).Err(); err != nil {
		log.Printf("Verification: failed to increment attempts for email %s: %v", email, err)
		return false, err
	}

	if storedCode != code {
		return false, errors.New("invalid code")
	}

	if err := redis.RedisClient.Del(redis.Ctx, fmt.Sprintf("verification:%s", email), fmt.Sprintf("attempts:%s", email)).Err(); err != nil {
		log.Printf("Verification: failed to delete code and attempts for email %s: %v", email, err)
		return false, err
	}
	return true, nil
}

func SendVerificationEmail(to string, code string, vs *verificationModels.VerificationService) error {
	m := gomail.NewMessage()
	m.SetHeader("From", vs.FromEmail)
	m.SetHeader("To", to)
	m.SetHeader("Subject", "Verification Code")

	htmlBody := fmt.Sprintf(`
		<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
			<h2>Добро пожаловать!</h2>
			<p>Ваш код подтверждения для завершения регистрации:</p>
			<p style="font-size: 24px; font-weight: bold; color: #2c5aa0;">%s</p>
			<p>Код действителен в течение 10 минут.</p>
			<hr>
			<p style="color: #666; font-size: 12px;">
				Если вы не регистрировались, проигнорируйте это письмо.
			</p>
		</div>
	`, code)

	m.SetBody("text/html", htmlBody)

	return vs.EmailDialer.DialAndSend(m)
}

func DeleteCode(email string, vs *verificationModels.VerificationService) error {
	if err := redis.RedisClient.Del(redis.Ctx, fmt.Sprintf("verification:%s", email), fmt.Sprintf("attempts:%s", email)).Err(); err != nil {
		log.Printf("Verification: failed to delete code and attempts for email %s: %v", email, err)
		return err
	}
	return nil
}

func IsCodeAlreadySend(email string) (bool, error) {
	exists, err := redis.RedisClient.Exists(redis.Ctx, fmt.Sprintf("verification:%s", email)).Result()
	if err != nil {
		log.Printf("Verification: failed to check if code already sent for email %s: %v", email, err)
		return false, err
	}
	return exists > 0, nil
}

func GetCodeTTL(email string) (time.Duration, error) {
	return redis.RedisClient.TTL(redis.Ctx, "verify:"+email).Result()
}

func getEnv(key string) string {
	envString := os.Getenv(key)
	return envString
}
