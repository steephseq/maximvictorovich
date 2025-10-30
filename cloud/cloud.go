package cloud

import (
	"context"
	"fmt"
	"io"
	"path/filepath"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	//"github.com/aws/aws-sdk-go-v2/aws/credentials"
)

func UploadFile(ctx context.Context, s3Client *s3.Client, bucket string, file io.Reader, filename string, folder string, timeStamp string) (string, error) {
	ext := filepath.Ext(filename)
	if ext == "" {
		ext = ".dat"
	}

	key := fmt.Sprintf("%s/%s%s", folder, timeStamp, ext)
	upload := manager.NewUploader(s3Client)

	_, err := upload.Upload(ctx, &s3.PutObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
		Body:   file,
	})

	if err != nil {
		return "", fmt.Errorf("failed to upload file,%w", err)
	}

	return key, nil
}
