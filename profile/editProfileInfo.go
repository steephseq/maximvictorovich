package profile

import (
	"errors"
	"log"
	"mess/database"
	profileModels "mess/models/profileModels"
	JWTModels "mess/models/services/jwt"
	"mess/services"
	"net/http"
)

var ErrForbidden = errors.New("forbidden")

func SetBioHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("setbiohandler trigged")
	SetXUnivesalHandler(w, r)
}

func SetNameHandler(w http.ResponseWriter, r *http.Request) {
	SetXUnivesalHandler(w, r)
}

func SetUserNameHandler(w http.ResponseWriter, r *http.Request) {
	SetXUnivesalHandler(w, r)
}

func SetXUnivesalHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		services.MethodNotAllowed(w, r)
		return
	}

	var parameterName profileModels.NewProfileParameter
	if err := services.DecodeRequest(w, r, &parameterName); err != nil {
		services.ResponseFunc(w, http.StatusBadRequest, "bad request", nil)
		return
	}

	userIDJWT := r.Context().Value(JWTModels.UserIDKey)
	userID, ok := userIDJWT.(uint)
	if !ok {
		log.Println("invalid token from edit profile")
		services.ResponseFunc(w, http.StatusUnauthorized, "invalid token", nil)
		return
	}
	if err := checkRights(parameterName, int(userID), parameterName.Action); err != nil {
		if errors.Is(err, ErrForbidden) {
			services.ResponseFunc(w, http.StatusForbidden, "user havent rights", nil)
			return
		}
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to check rights", nil)
		return
	}

	if err := setX(parameterName, parameterName.Column); err != nil {
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to change info", nil)
		return
	}
	services.ResponseFunc(w, http.StatusOK, "successful change info", parameterName)
}

func setX(newParameter profileModels.NewProfileParameter, column string) error {
	if err := database.SetXInfo(newParameter, column); err != nil {
		log.Printf("failed to change %s for user/group%d:%v", newParameter.Column, newParameter.OwnerID, err)
		return err
	}
	return nil
}

func checkRights(newParameter profileModels.NewProfileParameter, uid int, action string) error {
	log.Println(newParameter)
	if newParameter.IsGroup {
		canAction, err := database.CanUserX(uid, newParameter.OwnerID, action)
		if err != nil {
			log.Println(err)
			log.Println("failed to check ")
			return err
		}
		if !canAction {
			return ErrForbidden
		}
	} else {
		if uid != newParameter.OwnerID {
			return ErrForbidden
		}
	}
	return nil
}
