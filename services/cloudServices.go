package services

import (
	"fmt"
	"log"
	userModels "mess/models/usersModels"
	"os"

	"github.com/joho/godotenv"
)

var (
	BaseURL string
	Bucket  string
)

func InitCloudConfig() {
	if err := godotenv.Load(); err != nil {
		log.Println("failed to load .env /profile/MyProfileHandler\nerror:", err)
	}
	BaseURL = os.Getenv("CLOUD_URL")
	log.Println("BaseURL:", BaseURL)
	Bucket = os.Getenv("CLOUD_BUCKET")
	log.Println("Bucket:", Bucket)
}

func GetAvatarURL(filename string) string {
	if filename == "" {
		return ""
	}

	url := fmt.Sprintf("%s%s%s%s", BaseURL, Bucket, "avatars/", filename)
	log.Println("url:", url)
	return url
}

func GetFileURL(filename, folder string) string {
	if filename == "" {
		return ""
	}
	return fmt.Sprintf("%s%s%s%s", BaseURL, Bucket, folder, "/"+filename)
}

func FormatUsersResponse(users []userModels.User) []map[string]interface{} {
	var response []map[string]interface{}
	for _, user := range users {
		response = append(response, map[string]interface{}{
			"id":        user.ID,
			"name":      user.Name,
			"username":  user.UserName,
			"url":       GetAvatarURL(user.Avatar),
			"is_online": user.IsOnline,
			"bio":       user.Bio,
		})
	}
	return response
}
