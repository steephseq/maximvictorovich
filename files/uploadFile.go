package files

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"log"
	"mess/cloud"
	database "mess/database"
	chatsModels "mess/models/chatsModels"
	JWTModels "mess/models/services/jwt"
	"mess/services"
	"mime/multipart"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var (
	videoExtensions = map[string]bool{
		".mp4":  true,
		".mov":  true,
		".avi":  true,
		".mkv":  true,
		".webm": true,
	}
	photoExtensions = map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".gif":  true,
		".bmp":  true,
		".webp": true,
		".svg":  true,
		".heic": true,
	}
	audioExtensions = map[string]bool{
		".mp3":  true,
		".wav":  true,
		".ogg":  true,
		".webm": true,
		".m4a":  true,
		".aac":  true,
		".flac": true,
	}
)

func UploadFileHandler(w http.ResponseWriter, r *http.Request) {
	id, err := validateRequest(w, r)
	if err != nil {
		log.Printf("UploadFileHandler: failed to validate request: %v", err)
		services.ResponseFunc(w, http.StatusBadRequest, "failed to validate request", nil)
		return
	}

	file, filename, ext, err := getFile(r)
	if err != nil {
		log.Printf("UploadFileHandler: failed to get file: %v", err)
		services.ResponseFunc(w, http.StatusBadRequest, "failed to get file", nil)
		return
	}
	defer file.Close()

	if !isSupportedType(ext) {
		log.Printf("UploadFileHandler: unsupported file type: %s", ext)
		services.ResponseFunc(w, http.StatusBadRequest, "unsupported file type", nil)
		return
	}

	ctx, s3Client, bucket := bucketLoad()
	if ctx == nil || s3Client == nil || bucket == "" {
		log.Printf("UploadFileHandler: failed to load bucket")
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to load bucket", nil)
		return
	}

	result, duration, err := processFile(ext, id, file, filename, ctx, s3Client, bucket)
	if err != nil {
		log.Printf("UploadFileHandler: failed to process file: %v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to process file", nil)
		return
	}

	msg, err := createMessage(ext, id, r, result.fileKey, duration)
	if err != nil {
		log.Printf("UploadFileHandler: failed to create message: %v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to create message", nil)
		return
	}
	if err := database.UpdateMessage(msg); err != nil {
		log.Printf("UploadFileHandler: failed to update message: %v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to update message", nil)
		return
	}

	services.ResponseFunc(w, http.StatusOK, "successful", map[string]string{
		"filename": strings.TrimPrefix(result.fileKey, "messages/"),
	})
}

type processResult struct {
	fileKey      string
	thumbnailKey string
}

func processFile(ext string, id int, file multipart.File, filename string, ctx context.Context, s3Client *s3.Client, bucket string) (*processResult, int, error) {
	var duration int
	if videoExtensions[ext] || audioExtensions[ext] {
		return processMediaFile(ext, id, file, filename, ctx, s3Client, bucket)
	}
	if photoExtensions[ext] {
		result, err := processPhotoFile(file, filename, ctx, s3Client, bucket)
		return result, duration, err
	}
	return nil, 0, nil
}

func processMediaFile(ext string, id int, file multipart.File, filename string, ctx context.Context, s3Client *s3.Client, bucket string) (*processResult, int, error) {
	tmpFile, err := createTempFile(ext, file)
	if err != nil {
		return nil, 0, err
	}
	defer os.Remove(tmpFile.Name())
	defer tmpFile.Close()

	duration, _ := getMediaDuration(tmpFile.Name())
	var result *processResult
	if videoExtensions[ext] {
		result, err = processVideoFile(ext, id, filename, ctx, s3Client, bucket, tmpFile)
	} else {
		result, err = processAudioFile(id, filename, ctx, s3Client, bucket, tmpFile)
	}
	return result, duration, err
}

func processVideoFile(ext string, id int, filename string, ctx context.Context, s3Client *s3.Client, bucket string, tmpFile *os.File) (*processResult, error) {
	thumbnailKey, fileKey, err := videoUpload(id, filename, ctx, s3Client, bucket, tmpFile)
	if err != nil {
		return nil, err
	}

	return &processResult{
		fileKey:      fileKey,
		thumbnailKey: thumbnailKey,
	}, nil
}

func processAudioFile(id int, filename string, ctx context.Context, s3Client *s3.Client, bucket string, tmpFile *os.File) (*processResult, error) {
	if _, err := tmpFile.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	fileKey, err := cloud.UploadFile(ctx, s3Client, bucket, tmpFile, filename, "messages", strconv.FormatInt(time.Now().UnixNano(), 10))
	if err != nil {
		return nil, err
	}
	return &processResult{
		fileKey:      fileKey,
		thumbnailKey: "",
	}, nil
}

func processPhotoFile(file multipart.File, filename string, ctx context.Context, s3Client *s3.Client, bucket string) (*processResult, error) {
	if seeker, ok := file.(io.Seeker); ok {
		if _, err := seeker.Seek(0, io.SeekStart); err != nil {
			return nil, err
		}
	}
	fileKey, err := cloud.UploadFile(ctx, s3Client, bucket, file, filename, "messages", strconv.FormatInt(time.Now().UnixNano(), 10))
	if err != nil {
		return nil, err
	}
	return &processResult{
		fileKey:      fileKey,
		thumbnailKey: "",
	}, nil
}

func createTempFile(ext string, file multipart.File) (*os.File, error) {
	tmpFile, err := os.CreateTemp("", "upload-*"+ext)
	if err != nil {
		return nil, errors.New("failed to create temp file")
	}

	if _, err := io.Copy(tmpFile, file); err != nil {
		tmpFile.Close()
		os.Remove(tmpFile.Name())
		return nil, errors.New("failed to copy file")
	}

	if _, err := tmpFile.Seek(0, io.SeekStart); err != nil {
		tmpFile.Close()
		os.Remove(tmpFile.Name())
		return nil, errors.New("failed to seek file")
	}
	return tmpFile, nil
}

func videoUpload(id int, filename string, ctx context.Context, s3Client *s3.Client, bucket string, tmpFile *os.File) (string, string, error) {
	timeStamp := strconv.FormatInt(time.Now().UnixNano(), 10)
	keyThumbnails := fmt.Sprintf("%s.jpg", timeStamp)

	if err := thumbnailCreate(tmpFile, ctx, s3Client, bucket, keyThumbnails, timeStamp); err != nil {
		log.Printf("VideoUpload: failed to create thumbnail: %v", err)
		return "", "", err
	}

	key, err := cloud.UploadFile(ctx, s3Client, bucket, tmpFile, filename, "messages", timeStamp)
	if err != nil {
		log.Printf("VideoUpload: failed to upload video: %v", err)
		return "", "", err
	}

	if err = database.AddThumbnail(id, keyThumbnails); err != nil {
		log.Printf("VideoUpload: failed to add thumbnail to DB: %v", err)
	}

	return keyThumbnails, key, nil
}

func thumbnailCreate(tmpFile *os.File, ctx context.Context, s3Client *s3.Client, bucket string, filename string, timeStamp string) error {
	cmd := exec.Command("/usr/bin/ffmpeg",
		"-ss", "0",
		"-i", tmpFile.Name(),
		"-vframes", "1",
		"-q:v", "2",
		"-f", "mjpeg",
		"pipe:1")

	var thumbBuf bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &thumbBuf
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		log.Printf("VideoUpload: ffmpeg error: %v", err)
		return fmt.Errorf("ffmpeg failed: %v, stderr: %s", err, stderr.String())
	}

	_, err := cloud.UploadFile(ctx, s3Client, bucket, bytes.NewReader(thumbBuf.Bytes()), filename, "miniatures", timeStamp)
	if err != nil {
		log.Printf("VideoUpload: failed to upload thumbnail: %v", err)
		return fmt.Errorf("failed to upload thumbnail: %v", err)
	}
	return nil
}

func getMediaDuration(filePath string) (int, error) {
	cmd := exec.Command("ffprobe",
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1",
		filePath,
	)
	output, err := cmd.Output()
	if err != nil {
		return 0, err
	}

	str := strings.TrimSpace(string(output))
	durationFloat, err := strconv.ParseFloat(str, 64)
	if err != nil {
		return 0, err
	}

	duration := int(durationFloat)
	return duration, nil
}

func validateRequest(w http.ResponseWriter, r *http.Request) (int, error) {
	r.Body = http.MaxBytesReader(w, r.Body, 1024<<20)
	if err := r.ParseMultipartForm(20 << 20); err != nil {
		return 0, err
	}

	messageIDStr := r.FormValue("message_id")
	var id int
	var err error
	if messageIDStr != "" {
		id, err = strconv.Atoi(messageIDStr)
		if err != nil {
			return 0, err
		}
	}
	return id, nil
}

func getFile(r *http.Request) (multipart.File, string, string, error) {
	file, header, err := r.FormFile("file")
	if err != nil {
		return nil, "", "", err
	}

	filename := header.Filename
	ext := strings.ToLower(filepath.Ext(filename))
	return file, filename, ext, nil
}

func bucketLoad() (context.Context, *s3.Client, string) {
	bucket := os.Getenv("BUCKET")
	if bucket == "" {
		log.Printf("UploadFileHandler: bucket is empty")
		return nil, nil, ""
	}

	ctx, s3Client := cloud.NewYandexStorage(bucket)
	return ctx, s3Client, bucket

}

func createMessage(ext string, id int, r *http.Request, key string, duration int) (chatsModels.Message, error) {
	filename := sql.NullString{Valid: true, String: strings.TrimPrefix(key, "messages/")}
	msg := chatsModels.Message{
		ID:       id,
		IsReady:  true,
		UserId:   int(r.Context().Value(JWTModels.UserIDKey).(uint)),
		Filename: filename,
	}

	if videoExtensions[ext] || audioExtensions[ext] {
		msg.Duration = sql.NullInt64{Valid: true, Int64: int64(duration)}
	}
	return msg, nil
}

func isSupportedType(ext string) bool {
	return videoExtensions[ext] || audioExtensions[ext] || photoExtensions[ext]
}
