package database

import "log"

func AddThumbnail(url string, content string) error {
	log.Println("thumbnail trigger")
	query := `UPDATE messages 
			SET thumbnail_url=$1 
			WHERE content=$2`

	_, err := DB.Exec(query, url, content)
	if err != nil {
		return err
	}
	return nil
}
