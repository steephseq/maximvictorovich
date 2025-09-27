package main

import (
	"log"

	"mess/authentification"
	"mess/chats"
	"mess/cloud"

	"mess/profile"

	"mess/database"
	"mess/search"
	"mess/services"
	"net/http"
)

func main() {
	if err := database.InitDB(); err != nil {
		log.Printf("failed to init DB,error:%v", err)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/register", authentification.RegisterHandler)
	mux.HandleFunc("/login", authentification.LoginHandler)
	mux.Handle("/chats", authentification.JWTMiddleware(http.HandlerFunc(chats.ShowChatsHandler)))
	mux.Handle("/messages", authentification.JWTMiddleware(http.HandlerFunc(chats.ShowMessagesHandler)))
	mux.Handle("/searchUser", authentification.JWTMiddleware(http.HandlerFunc(search.SearchUserHandler)))
	mux.Handle("/createChat", authentification.JWTMiddleware(http.HandlerFunc(chats.CreateChatHandler)))
	mux.Handle("/chatExists", authentification.JWTMiddleware(http.HandlerFunc(chats.ExistsChatHandler)))
	mux.Handle("/create121Chat", authentification.JWTMiddleware(http.HandlerFunc(chats.CreateChat121Handler)))
	mux.Handle("/profile", authentification.JWTMiddleware(http.HandlerFunc(profile.OpenProfile)))
	mux.Handle("/addUsers", authentification.JWTMiddleware(http.HandlerFunc(chats.AddUserIntoChatHandler)))
	mux.Handle("/removeUserFromChat", authentification.JWTMiddleware(http.HandlerFunc(chats.RemoveUserFromChatHandler)))
	mux.Handle("/newAdmin", authentification.JWTMiddleware(http.HandlerFunc(chats.MadeAdminHandler)))
	mux.Handle("/howCanIDoMessage", authentification.JWTMiddleware(http.HandlerFunc(chats.HowCanIDoWithMessageHandler)))
	mux.Handle("/deleteMessage", authentification.JWTMiddleware(http.HandlerFunc(chats.DeleteMessageHandler)))
	mux.Handle("/setAvatar", authentification.JWTMiddleware(http.HandlerFunc(cloud.SetAvatarHandler)))

	mux.HandleFunc("/ws", chats.SendMessageHandler)

	fs := http.FileServer(http.Dir("./frontend"))
	mux.Handle("/", fs)

	handler := services.WithCORS(mux)
	log.Println("server is listening on :8080")
	if err := http.ListenAndServe(":8080", handler); err != nil {
		log.Fatal(err)
	}
}
