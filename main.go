package main

import (
	"log"

	"mess/authentification"
	"mess/chats"
	"mess/cloud"
	"mess/database"
	"mess/files"
	"mess/onlineStatus"
	"mess/profile"
	"mess/redis"
	"mess/search"
	"mess/services"
	"net/http"
)

// Временные handlers для отладки
func debugProtectedHandler(h http.HandlerFunc) http.Handler {
	return authentification.JWTMiddleware(h)
}

func debugPublicHandler(h http.HandlerFunc) http.Handler {
	return http.HandlerFunc(h)
}

func main() {
	if err := database.InitDB(); err != nil {
		log.Printf("failed to init DB,error:%v", err)
	}
	if err := redis.InitRedis(); err != nil {
		log.Printf("failed to init redis,error:%v", err)
	}

	//ctx, cancel := context.WithCancel(context.Background())
	//defer cancel()
	//go onlineStatus.OnlineWorker(ctx)
	//go onlineStatus.RedisExpireWorker(ctx)

	mux := http.NewServeMux()

	// Public routes (БЕЗ RateLimit для отладки)
	mux.Handle("/register", debugPublicHandler(authentification.RegisterHandler))
	mux.Handle("/login", debugPublicHandler(authentification.LoginHandler))

	// Protected routes (ТОЛЬКО JWT, без RateLimit)
	mux.Handle("/onlineUsers", debugProtectedHandler(onlineStatus.OnlineStatusHandler))
	mux.Handle("/chats", debugProtectedHandler(chats.ShowChatsHandler))
	mux.Handle("/messages", debugProtectedHandler(chats.ShowMessagesHandler))
	mux.Handle("/searchUser", debugProtectedHandler(search.SearchUserHandler))
	mux.Handle("/createChat", debugProtectedHandler(chats.CreateChatHandler))
	mux.Handle("/chatExists", debugProtectedHandler(chats.ExistsChatHandler))
	mux.Handle("/editMessage", debugProtectedHandler(chats.EditMessageHandler))
	mux.Handle("/create121Chat", debugProtectedHandler(chats.CreateChat121Handler))
	mux.Handle("/profile", debugProtectedHandler(profile.OpenProfileHandler))
	mux.Handle("/addUsers", debugProtectedHandler(chats.AddUserIntoChatHandler))
	mux.Handle("/removeUserFromChat", debugProtectedHandler(chats.RemoveUserFromChatHandler))
	mux.Handle("/newAdmin", debugProtectedHandler(chats.MadeAdminHandler))
	mux.Handle("/howCanIDoMessage", debugProtectedHandler(chats.HowCanIDoWithMessageHandler))
	mux.Handle("/deleteMessage", debugProtectedHandler(chats.DeleteMessageHandler))
	mux.Handle("/setAvatar", debugProtectedHandler(cloud.SetAvatarHandler))
	mux.Handle("/myProfileHP", debugProtectedHandler(profile.MyProfileHandler))
	mux.Handle("/setBio", debugProtectedHandler(profile.SetBioHandler))
	mux.Handle("/uploadFile", debugProtectedHandler(files.UploadFileHandler))
	mux.Handle("/setName", debugProtectedHandler(profile.SetNameHandler))
	mux.Handle("/setUserName", debugProtectedHandler(profile.SetUserNameHandler))
	mux.Handle("/createEmptyMessage", debugProtectedHandler(chats.CreateEmptyMessage))
	mux.Handle("/ws/onlineStatus", debugProtectedHandler(onlineStatus.OnlineStatusHandler))
	mux.Handle("/ws/profile", debugProtectedHandler(profile.ProfileWSHandler))
	mux.Handle("/ws", debugProtectedHandler(chats.SendMessageHandler))
	mux.Handle("/howCanIDoUser", debugProtectedHandler(chats.HowCanDoWithUserHandler))
	// Static files
	fs := http.FileServer(http.Dir("./frontend"))
	mux.Handle("/", fs)

	handler := services.WithCORS(mux)
	log.Println("server is listening on :8080")
	if err := http.ListenAndServeTLS(":8080", "localhost.crt", "localhost.key", handler); err != nil {
		log.Fatal(err)
	}
}
