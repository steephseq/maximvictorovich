package cloud

import (
	"context"
	"log"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/joho/godotenv"
)

func NewYandexStorage(bucket string) (context.Context, *s3.Client) {
	if err := godotenv.Load(); err != nil {
		log.Fatal(err)
	}
	accessKey := os.Getenv("YANDEX_CLOUD_ACCESS_KEY")
	secretKey := os.Getenv("YANDEX_CLOUD_SECRET_KEY")
	if secretKey == "" || accessKey == "" {
		log.Fatal("secretkey empty")
	}

	ctx := context.Background()

	s3CLient := s3.New(s3.Options{
		Region: "ru-central1",
		Credentials: aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider(
			accessKey,
			secretKey,
			"",
		)),
		EndpointResolver: s3.EndpointResolverFromURL("https://storage.yandexcloud.net"),
	})
	return ctx, s3CLient
}
