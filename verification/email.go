package verification

import (
	"crypto/rand"
	"fmt"
	"os"

	"gopkg.in/gomail.v2"
)

func GenerateVerificationCode() (string, error) {

	b := make([]byte, 3)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", int(b[0])<<16|int(b[1])<<8|int(b[2])%1000000), nil
}

func SendVerificationEmail(to string, code string) error {
	m := gomail.NewMessage()
	m.SetHeader("From", getEnv("MAIL"))
	m.SetHeader("To", to)
	m.SetHeader("Subject", "Verification Code")
	m.SetBody("text/plain", fmt.Sprintf("Your verification code is: %s", code))

	d := gomail.NewDialer("smtp.yandex.ru", 465, getEnv("MAIL"), getEnv("MAIL_PASSWORD"))
	d.SSL = true
	return d.DialAndSend(m)
}

func getEnv(key string) string {
	envString := os.Getenv(key)
	return envString

}
