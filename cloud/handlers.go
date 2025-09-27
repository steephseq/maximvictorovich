package cloud

import (
	"log"
	"mess/database"
	cloudModels "mess/models/cloudModels"
	JWTModels "mess/models/services/jwt"
	"mess/services"
	"net/http"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

func SetAvatarHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		services.ResponseFunc(w, http.StatusMethodNotAllowed, "method not allowed", nil)
		return
	}

	var avatar cloudModels.Avatar
	avatar.OwnerType = r.FormValue("owner_type")
	ownerIDStr := r.FormValue("owner_id")
	ownerID, _ := strconv.Atoi(ownerIDStr)
	avatar.OwnerID = ownerID

	if avatar.OwnerType != "user" && avatar.OwnerType != "chat" {
		services.ResponseFunc(w, http.StatusBadRequest, "invalid owner type", nil)
		return
	}

	if err := godotenv.Load(); err != nil {
		log.Fatal(err)
	}

	bucket := os.Getenv("BUCKET")
	if bucket == "" {
		services.ResponseFunc(w, http.StatusInternalServerError, "failed add new avatar", nil)
		return
	}

	if err := r.ParseMultipartForm(5 << 20); err != nil {
		services.ResponseFunc(w, http.StatusBadRequest, "max size 5mb", nil)
		return
	}

	file, header, err := r.FormFile("avatar")
	if err != nil {
		services.ResponseFunc(w, http.StatusBadRequest, "cant find header", nil)
		return
	}
	defer file.Close()

	ctx, s3Client := NewYandexStorage(bucket)
	url, err := UploadFile(ctx, s3Client, bucket, file, header.Filename, "avatars")
	if err != nil {
		log.Printf("%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to upload avatar", nil)
		return
	}

	userID := r.Context().Value(JWTModels.UserIDKey).(uint)
	if avatar.OwnerType == "chat" {
		canChangeAvatar, err := database.CanUserX(int(userID), avatar.OwnerID, "can_change_avatar")
		if err != nil {
			log.Println(err)
			services.ResponseFunc(w, http.StatusInternalServerError, "failed to check roots", nil)
			return
		}
		if !canChangeAvatar {
			services.ResponseFunc(w, http.StatusForbidden, "user hasnt rights", nil)
			return

		} else {
			avatar.OwnerID = int(userID)
		}
	}
	avatar.URL = url
	if err = database.UpdateAvatar(avatar); err != nil {
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to update user avatar", nil)
		return
	}
	services.ResponseFunc(w, http.StatusOK, "successful new avatar", map[string]string{"url": url})
}
