package database

func AddThumbnail(id int, url string) error {
	query := `INSERT 
			INTO thumbnails(message_id,filename)
			VALUES ($1,$2)`

	_, err := DB.Exec(query, id, url)
	if err != nil {
		return err
	}
	return nil
}
