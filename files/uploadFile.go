package files

import (
	"bytes"
	"context"
	"io"
	"log"
	"mess/cloud"
	"mess/services"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	database "mess/database"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/joho/godotenv"
	ffmpeg_go "github.com/u2takey/ffmpeg-go"
)

func UploadFileHandler(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1024<<20)
	if err := r.ParseMultipartForm(20 << 20); err != nil {
		log.Println(err)
		services.ResponseFunc(w, http.StatusBadRequest, "failed to parse form", nil)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		services.ResponseFunc(w, http.StatusBadRequest, "failed to get file", nil)
		return
	}

	defer file.Close()

	filename := header.Filename
	if err := godotenv.Load(); err != nil {
		log.Fatal(err)
	}

	bucket := os.Getenv("BUCKET")
	if bucket == "" {
		services.ResponseFunc(w, http.StatusInternalServerError, "failed add new avatar", nil)
		return
	}

	ctx, s3Client := cloud.NewYandexStorage(bucket)

	videoExtensions := map[string]bool{
		".mp4":  true,
		".mov":  true,
		".avi":  true,
		".mkv":  true,
		".webm": true,
	}
	ext := strings.ToLower(filepath.Ext(filename))
	if videoExtensions[ext] {
		urlThumbnail, url, err := VideoUpload(filename, ctx, s3Client, bucket, file, ext)
		if err != nil {
			services.ResponseFunc(w, http.StatusInternalServerError, "failed to upload video", nil)
			return
		}
		services.ResponseFunc(w, http.StatusOK, "successful", map[string]string{"urlThumbnail": urlThumbnail, "url": url})
		return
	} else {
		url, err := cloud.UploadFile(ctx, s3Client, bucket, file, filename, "messages")
		if err != nil {
			services.ResponseFunc(w, http.StatusInternalServerError, "failed to upload file", nil)
			return
		}
		services.ResponseFunc(w, http.StatusOK, "successful", map[string]string{"url": url})
	}
}

func VideoUpload(filename string, ctx context.Context, s3Client *s3.Client, bucket string, file io.Reader, ext string) (string, string, error) {
	tmpFile, err := os.CreateTemp("", "upload-*"+ext)
	if err != nil {
		return "", "", err
	}
	defer os.Remove(tmpFile.Name())

	if _, err := io.Copy(tmpFile, file); err != nil {
		return "", "", err
	}

	if _, err := tmpFile.Seek(0, io.SeekStart); err != nil {
		return "", "", err
	}

	var thumbBuf bytes.Buffer
	if err := ffmpeg_go.Input(tmpFile.Name(), ffmpeg_go.KwArgs{"ss": "0"}).
		Filter("select", ffmpeg_go.Args{"gte(n,0)"}).
		Output("pipe:1", ffmpeg_go.KwArgs{"vframes": "1", "format": "mjpeg"}).
		WithOutput(&thumbBuf, nil).
		Run(); err != nil {
		return "", "", err
	}
	urlThumbnail, err := cloud.UploadFile(ctx, s3Client, bucket, bytes.NewReader(thumbBuf.Bytes()), "thumb_"+filename, "miniatures")
	if err != nil {
		return "", "", err
	}

	if _, err := tmpFile.Seek(0, io.SeekStart); err != nil {
		return "", "", err
	}
	url, err := cloud.UploadFile(ctx, s3Client, bucket, tmpFile, filename, "messages")
	if err != nil {
		return "", "", err
	}
	if err = database.AddThumbnail(urlThumbnail, url); err != nil {
		return "", "", err
	}
	return urlThumbnail, url, nil
}
