package search

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"mess/database"
	searchModels "mess/models/searchModels"
	usersModels "mess/models/usersModels"
	"mess/services"
	"net/http"
	"strconv"
)

func SearchUserHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("search handler triggered")
	if r.Method != http.MethodPost {
		log.Printf("not allowed method /searchUser")
		services.ResponseFunc(w, http.StatusMethodNotAllowed, "not allowed method", nil)
		return
	}

	var userSearchQuery searchModels.SearchRequest
	if err := json.NewDecoder(r.Body).Decode(&userSearchQuery); err != nil {
		log.Printf("failed to decode request,/auth/login\nerror:%v", err)
		services.ResponseFunc(w, http.StatusBadRequest, "failed to decode request", nil)
		return
	}
	/*if services.IsPhone(userSearchString){
		database.SearchByPhone()
	}
	*/
	if services.IsID(userSearchQuery.Query) {
		log.Printf("IsID = true")
		uid, err := strconv.Atoi(userSearchQuery.Query)
		if err != nil {
			log.Printf("failed to atoi userSearch,error:%v\nuserSearch:%s", err, userSearchQuery.Query)
			services.ResponseFunc(w, http.StatusInternalServerError, "failed to parse userSearch", nil)
			return
		}
		u, err := database.SearchByID(uid)
		if err != nil {
			log.Printf("failed to search by id,error:%v", err)
			services.ResponseFunc(w, http.StatusInternalServerError, "failed to search user", nil)
			return
		}
		log.Printf("successful search,user:%v", u)
		services.ResponseFunc(w, http.StatusOK, "successful search user", u)
		return
	}
	u, err := database.SearchByUserName(userSearchQuery.Query)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Printf("user not exists:%v", err)
			services.ResponseFunc(w, http.StatusOK, "user not exists", nil)
			return
		}
		log.Printf("failed to search user by username,error:%v", err)
		services.ResponseFunc(w, http.StatusInternalServerError, "failed to search user", nil)
		return
	}

	log.Printf("successful search ,u:%+v", u)
	url := services.GetAvatarURL(u.Avatar)
	u.Avatar = url
	services.ResponseFunc(w, http.StatusOK, "successful search", []usersModels.User{u})
}
