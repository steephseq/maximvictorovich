package models

import (
	"time"

	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type YandexStorage struct {
	Client *s3.Client
	Bucket string
}

type UploadURLResponse struct {
	URL      string    `json:"url"`
	FilePath string    `json:"file_path"`
	Expires  time.Time `json:"expires"`
}

type Attachment struct {
	ID        int64     `json:"id"`
	URL       string    `json:"url"`
	Type      string    `json:"type"`                 // image, video, audio, avatar, document
	UserID    *int64    `json:"user_id,omitempty"`    // аватарка или личный файл
	ChatID    *int64    `json:"chat_id,omitempty"`    // картинка чата
	MessageID *int64    `json:"message_id,omitempty"` // вложение в сообщении
	CreatedAt time.Time `json:"created_at"`
}

type Avatar struct {
	URL       string    `json:"url" db:"url"`
	IsGroup   bool      `json:"is_group" db:"is_group"`
	OwnerID   int       `json:"owner_id" db:"owner_id"`
	IsCurrent bool      `json:"is_current" db:"is_current"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}
