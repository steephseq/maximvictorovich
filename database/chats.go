package database

import (
	"fmt"
	"log"
	chatsModels "mess/models/chatsModels"
	models "mess/models/services/jwt"
	usersModels "mess/models/usersModels"
	"net/http"
	"sort"
	"strings"

	"github.com/lib/pq"
)

func GetChatsOnHomePage(uid int) ([]chatsModels.Chat, error) {
	var chatLst []chatsModels.Chat
	var groupChats []chatsModels.Chat
	var personalChats []chatsModels.Chat

	query := `SELECT DISTINCT
			c.id,
			c.is_group,
			u.username AS name,
			m.content AS last_message,
			COALESCE(m.created_at, c.updated_at) AS updated_at,
			a_user.url AS url
		FROM chats c
		JOIN chats_users cu ON cu.chat_id = c.id AND cu.user_id = $1
		JOIN chats_users cu_other ON cu_other.chat_id = c.id AND cu_other.user_id != $1
		JOIN users u ON u.id = cu_other.user_id
		LEFT JOIN avatars a_user ON a_user.owner_id = u.id AND a_user.is_group = false AND a_user.is_current = true
		LEFT JOIN LATERAL (
			SELECT content, created_at
			FROM messages 
			WHERE chat_id = c.id 
			ORDER BY created_at DESC 
			LIMIT 1
		) m ON true
		WHERE c.is_group = false`

	err1 := DB.Select(&personalChats, query, uid)

	query = `SELECT DISTINCT
    c.id,
    c.is_group,
    c.name,
    m.content AS last_message,
    COALESCE(m.created_at, c.updated_at) AS updated_at,
    a_group.url AS url
FROM chats c
JOIN chats_users cu ON cu.chat_id = c.id AND cu.user_id = $1
LEFT JOIN avatars a_group ON a_group.owner_id = c.id AND a_group.is_group = true AND a_group.is_current = true
LEFT JOIN LATERAL (
    SELECT content, created_at
    FROM messages 
    WHERE chat_id = c.id 
    ORDER BY created_at DESC 
    LIMIT 1
) m ON true
WHERE c.is_group = true`
	err2 := DB.Select(&groupChats, query, uid)
	if err1 != nil {
		return chatLst, err1
	}
	if err2 != nil {
		return chatLst, err2
	}

	chatLst = append(personalChats, groupChats...)
	var validChats []chatsModels.Chat
	var nilChats []chatsModels.Chat
	for _, chat := range chatLst {
		if chat.Updated_at != nil {
			validChats = append(validChats, chat)
		} else {
			nilChats = append(nilChats, chat)
		}
	}

	// Сортируй только валидные чаты
	sort.Slice(validChats, func(i, j int) bool {
		return validChats[i].Updated_at.After(*validChats[j].Updated_at)
	})

	// Добавь чаты без даты в конец (или начало)
	allChats := append(validChats, nilChats...)
	return allChats, nil
}

func CreateChat(c chatsModels.CreateChatRequest) (int, error) {
	if c.Avatar == "" {
		setDefaulAvatar(&c)
	}
	var chatID int

	query := `INSERT INTO chats (name,is_group)
				VALUES ($1,$2)
				RETURNING id`
	if err := DB.QueryRow(query, c.Name, c.Is_group).Scan(&chatID); err != nil {
		log.Printf("failed to create chat or get id,error:%v", err)
		return 0, err
	}

	query = `INSERT INTO avatars (url,is_group,owner_id,is_current)
			VALUES ($1,$2,$3,$4)`
	_, err := DB.Exec(query, c.Avatar, c.Is_group, chatID, true)
	if err != nil {
		log.Println("failed create chat", err)
		return chatID, err
	}
	return chatID, nil
}

func setDefaulAvatar(c *chatsModels.CreateChatRequest) {
	if c.Is_group {
		c.Avatar = "https://storage.yandexcloud.net/imagesmaxim/avatars/group.jpg"
	} else {
		c.Avatar = "https://storage.yandexcloud.net/imagesmaxim/avatars/1x1.jpg"
	}
}
func AddUserIntoChat(chatID int, userIDs []int, r *http.Request) (added []int, alreadyExists []int, err error) {
	query := "INSERT INTO chats_users (chat_id,user_id) VALUES "
	if len(userIDs) == 0 {
		return
	}

	authorID := r.Context().Value(models.UserIDKey).(uint)
	args := []interface{}{}
	values := []string{}
	i := 1
	for _, userID := range userIDs {
		exists, err := ExistsUserIntoChat(chatID, userID)
		if err != nil {
			continue
		}
		if exists {
			alreadyExists = append(alreadyExists, userID)
			continue
		}
		if userID == int(authorID) {
			continue
		}
		added = append(added, userID)
	}

	for _, userID := range added {
		values = append(values, fmt.Sprintf("($%d,$%d)", i, i+1))
		args = append(args, chatID, userID)
		i += 2
	}
	if len(values) == 0 {
		return
	}
	query += strings.Join(values, ", ")
	query += " ON CONFLICT DO NOTHING"
	_, err = DB.Exec(query, args...)
	return added, alreadyExists, err
}

func AddCreatorToChat(cid int, aid int) error {
	query := `INSERT INTO
		chats_users (chat_id, user_id)
		VALUES ($1,$2)
		ON CONFLICT DO NOTHING`
	_, err := DB.Exec(query, cid, aid)
	return err
}

func ExistsUserIntoChat(cid int, uid int) (bool, error) {
	query := `SELECT EXISTS
			(SELECT 1 FROM chats_users cu
			WHERE cu.chat_id=$1 AND cu.user_id=$2)`
	var exists bool
	err := DB.Get(&exists, query, cid, uid)
	return exists, err
}

func GetChatsByUserID(uid int) ([]chatsModels.Chat, error) {
	var userChats []chatsModels.Chat
	err := DB.Select(&userChats, "SELECT c.id,c.name FROM chats c JOIN chat_users cu ON c.id=cu.chat_id WHERE cu.user_id=$1 ORDER BY c.updated_at DESC", uid)
	return userChats, err
}

func ChatExists121ByUsers(uid int, uid2 int) (int, error) {
	query := `SELECT 
			c.id
			FROM chats c 
			JOIN chats_users cu ON cu.chat_id=c.id
			JOIN chats_users cu2 ON cu2.chat_id=c.id
			WHERE c.is_group=false AND cu.user_id=$1 AND cu2.user_id=$2
			LIMIT 1 `
	var chatID int

	err := DB.Get(&chatID, query, uid, uid2)
	return chatID, err
}

func ChatExistsByID(chatID uint64) (bool, error) {
	var exists bool
	err := DB.Get(&exists, "SELECT EXISTS (SELECT 1 FROM chats WHERE id=$1)", chatID)
	return exists, err
}

func GetMessages(chatID uint64) ([]chatsModels.Message, error) {
	var messagesList []chatsModels.Message
	err := DB.Select(&messagesList, `SELECT 
		m.id,u.name,
		m.chat_id,
		m.user_id,
		m.content,
		m.thumbnail_url,
		m.created_at 
		FROM messages m 
		JOIN users u ON m.user_id=u.id 
		WHERE chat_id=$1
		ORDER BY m.created_at ASC`, chatID)
	return messagesList, err
}

func SaveMessageToDB(msg chatsModels.Message) error {
	_, err := DB.NamedExec("INSERT INTO messages (chat_id,user_id,content,created_at) VALUES (:chat_id,:user_id,:content,:created_at)", &msg)
	log.Println(msg)
	return err
}

func DeleteUserFromChat(chatID int, userIDs []int) error {
	query := `DELETE FROM chats_users
				WHERE chat_id = $1 AND user_id= ANY($2)`

	_, err := DB.Exec(query, chatID, pq.Array(userIDs))
	return err
}

func IsUserINChat(chatID int, userIDs []int) ([]int, error) {
	if len(userIDs) == 0 {
		return []int{}, nil
	}

	query := `SELECT user_id 
			FROM chats_users
			WHERE chat_id=$1 AND user_id=ANY($2)`

	rows, err := DB.Query(query, chatID, pq.Array(userIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var inChat []int
	for rows.Next() {
		var userID int
		if err := rows.Scan(&userID); err != nil {
			return nil, err
		}
		inChat = append(inChat, userID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return inChat, nil
}

func AddAdmin(Admin usersModels.AdminRoots) error {
	_, err := DB.NamedExec(`INSERT INTO chats_roles 
				(user_id,chat_id,title,can_delete_messages,can_ban_users,can_manage_roles,can_change_avatar) 
				VALUES (:user_id,:chat_id,:title,:can_delete_messages,:can_ban_users,:can_manage_roles,:can_change_avatar)`, &Admin)
	return err
}

// check have user roots for doing X
func CanUserX(uid int, chatid int, action string) (bool, error) {
	allowedActions := map[string]bool{
		"can_delete_messages": true,
		"can_ban_users":       true,
		"can_manage_roles":    true,
		"can_change_avatar":   true,
		"can_change_bio":      true,
		"can_change_name":     true,
	}

	log.Println("action:", action)

	if !allowedActions[action] {
		return false, fmt.Errorf("invalid action")
	}

	query := fmt.Sprintf(`SELECT %s FROM chats_roles WHERE user_id=$1 AND chat_id=$2`, action)
	var exists bool
	if err := DB.Get(&exists, query, uid, chatid); err != nil {
		log.Println(err)
		return false, err
	}
	return exists, nil
}

func DeleteMessage(Action chatsModels.ActionInChat) error {
	query := "DELETE FROM messages  WHERE id=$1 AND chat_id=$2"

	_, err := DB.Exec(query, Action.MessageID, Action.ChatID)
	return err
}

func WhoAuthorMessage(messid int, chatid int) (int, error) {
	query := `SELECT user_id
		 FROM messages WHERE id=$1 AND chat_id=$2`

	var authorID int
	err := DB.Get(&authorID, query, messid, chatid)
	return authorID, err
}

func GetAvailableMessageActions(uid int, chatid int, messid int) (chatsModels.AvaliableActionsMessage, error) {
	var actions chatsModels.AvaliableActionsMessage

	authorID, err := WhoAuthorMessage(messid, chatid)
	if err != nil {
		return actions, err
	}

	isAuthor := (uid == authorID)
	if isAuthor {
		actions.CanEditMessage = true
		actions.CanDeleteMessage = true
	} else {
		query := `SELECT can_delete_messages 
			FROM chats_roles WHERE user_id=$1 AND chat_id=$2`

		var canDelete bool
		if err := DB.Get(&canDelete, query, uid, chatid); err != nil {
			return actions, err
		}
		actions.CanDeleteMessage = canDelete
		actions.CanEditMessage = false
	}
	return actions, nil
}

func GetChatByID(cid int) (chatsModels.Chat, error) {
	query := `SELECT
			c.id,
			c.name,
			c.is_group,
			c.updated_at,
			c.bio,
			a.url
			FROM chats c
			JOIN avatars a on a.owner_id=c.id
			WHERE c.id=$1 AND a.is_current=true`
	var chat chatsModels.Chat
	err := DB.Get(&chat, query, cid)
	return chat, err
}

// func for  profile user from chat
func GetAnotherUserForProfile(cid, uid int) (int, error) {
	query := `SELECT
		u.id
		FROM chats_users cu
		JOIN users u ON u.id=cu.user_id
		WHERE cu.chat_id=$1 AND u.id<>$2`

	var u int
	if err := DB.Get(&u, query, cid, uid); err != nil {
		return u, err
	}
	return u, nil
}

func DeleteChatForMe(cid, uid int) error {
	query := `UPDATE chats_users 
			SET is_hidden=false
			WHERE chat_id=$1 AND user_id=$2`
	_, err := DB.Exec(query, cid, uid)
	if err != nil {
		return err
	}
	return nil
}

func DeleteChat(cid int) error {
	if err := DeleteChatHelper(cid, "chat_id", "chats_users"); err != nil {
		return err
	}
	if err := DeleteChatHelper(cid, "chat_id", "messages"); err != nil {
		return err
	}
	if err := DeleteChatHelper(cid, "id", "chats"); err != nil {
		return err
	}
	return nil
}

func DeleteChatHelper(cid int, columnName, tableName string) error {
	if err := validateDeleteData(tableName, columnName); err != nil {
		return err
	}

	query := `DELETE
		FROM ` + tableName +
		` WHERE ` + columnName + `=$1`
	_, err := DB.Exec(query, cid)
	if err != nil {
		return err
	}
	return nil
}

func validateDeleteData(tableName, columnName string) error {
	switch tableName {
	case "chats_users":
		switch columnName {
		case "id":
			return nil
		case "chat_id":
			return nil
		default:
			return fmt.Errorf("invalid column name")
		}
	case "messages":
		switch columnName {
		case "id":
			return nil
		case "chat_id":
			return nil
		default:
			return fmt.Errorf("invalid column name")
		}
	case "chats":
		switch columnName {
		case "id":
			return nil
		case "chat_id":
			return nil
		default:
			return fmt.Errorf("invalid column name")
		}
	default:
		return fmt.Errorf("invalid delete action /DeleteChatHelper")
	}
}
