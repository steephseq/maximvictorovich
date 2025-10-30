package models

import "gopkg.in/gomail.v2"

type VerificationService struct {
	EmailDialer *gomail.Dialer
	FromEmail   string
}

type VerificationRequest struct {
	Email string
	Code  string
}
