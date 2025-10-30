package verification

/*import (
	"errors"
	"log"
	"net/http"
	"time"

	verificationModels "mess/models/verificationModels"
)

func SendCodeHandler(request verificationModels.VerificationRequest, r *http.Request) (error, time.Duration, string) {

	exists, err := IsCodeAlreadySend(request.Email)
	if err != nil {
		log.Printf("VerificationHandler:failed to check if code already sent,err:%v", err)
		return err, 0, ""
	}
	if exists {
		ttl, err := GetCodeTTL(request.Email)
		if err != nil {
			log.Printf("VerificationHandler:failed to get code ttl,err:%v", err)
			return err, 0
		}
		return errors.New("code already sent "), ttl
	}

	code, err := GenerateVerificationCode()
	if err != nil {
		log.Printf("VerificationHandler:failed to generate verification code,err:%v", err)
		return err, 0
	}
	if err := StoreCode(request.Email, code, 10*time.Minute); err != nil {
		log.Printf("VerificationHandler:failed to store code,err:%v", err)
		return err, 0
	}

	if err := SendVerificationEmail(request.Email, code, NewVerificationService()); err != nil {
		log.Printf("VerificationHandler:failed to send verification email,err:%v", err)
		if err := DeleteCode(request.Email, NewVerificationService()); err != nil {
			log.Printf("VerificationHandler:failed to delete code,err:%v", err)
		}
		return err, 0
	}

	return nil, 0, code
}
*/
