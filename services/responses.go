package services

import (
	"encoding/json"
	"log"
	models "mess/models/responseModels"
	"net/http"
)

func ResponseFunc(w http.ResponseWriter, status int, message string, data interface{}) {
	w.Header().Set("Content-type", "application/json")
	w.WriteHeader(status)

	resp := models.Response{
		Code:    status,
		Message: message,
		Data:    data,
	}

	if err := json.NewEncoder(w).Encode(resp); err != nil {
		log.Println("failed to write JSON response:", err)
	}
}

func MethodNotAllowed(w http.ResponseWriter, r *http.Request) {
	ResponseFunc(w, http.StatusMethodNotAllowed, "method not allowed", nil)
}

func DecodeRequest(w http.ResponseWriter, r *http.Request, structDecode interface{}) error {
	if err := json.NewDecoder(r.Body).Decode(structDecode); err != nil {
		ResponseFunc(w, http.StatusBadRequest, "bad request", nil)
		return err
	}
	return nil
}
