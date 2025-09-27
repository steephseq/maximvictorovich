package database

import (
	"log"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

var DB *sqlx.DB

func InitDB() error {
	/*	if err := godotenv.Load(); err != nil {
			log.Println("failed to load .env /database/DBMain\nerror:", err)
		}
		dbData := os.Getenv("DB_DSN")
		if dbData == "" {
			log.Println("dbData is empty")
		}

		DB, err := sqlx.Open("postgres", dbData)
		if err != nil {
			log.Println("failed to open connection with DB /database/DBMain\nerror:", err)
		}

		if err := DB.Ping(); err != nil {
			log.Println("failed to connent to DB /database/DBMain\nerror:", err)
		}

		return DB
	*/

	var err error
	DB, err = sqlx.Connect("postgres", "user=postgres password=postgres dbname=postgres sslmode=disable")
	if err != nil {
		log.Fatalf("failed to open connection with DB: %v", err)
		return err
	}
	return nil
}
