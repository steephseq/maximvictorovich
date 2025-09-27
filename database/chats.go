package database

import (
	"fmt"
	"log"
	chatsModels "mess/models/chatsModels"
	models "mess/models/services/jwt"
	usersModels "mess/models/usersModels"
	"net/http"
	"strings"
	"time"

	"github.com/lib/pq"
)

func GetChatsOnHomePage(uid int) ([]chatsModels.Chat, error) {
	var chatLst []chatsModels.Chat
	query := `SELECT
					c.id,
					MAX(c.updated_at) AS updated_at,
					c.is_group,
					CASE 
							WHEN c.is_group THEN c.name
							ELSE COALESCE(MAX(u.username), '')
					END AS name
				FROM chats c
				JOIN chats_users cu on cu.chat_id=c.id
				LEFT JOIN chats_users cu2 ON cu2.chat_id=c.id AND cu2.user_id <> $1
				LEFT JOIN users u on u.id=cu2.user_id
				WHERE cu.user_id=$1
				GROUP BY c.id, c.is_group, c.name;
					`
	err := DB.Select(&chatLst, query, uid)
	return chatLst, err
}

func CreateChat(c chatsModels.CreateChatRequest) (int, error) {
	c.Updated_at = time.Now()
	query := `INSERT INTO chats (name,is_group,updated_at)
				VALUES ($1,$2,$3)
				RETURNING ID`
	var chatID int
	if err := DB.QueryRow(query, c.Name, c.Is_group, c.Updated_at).Scan(&chatID); err != nil {
		log.Printf("failed to create chat or get id,error:%v", err)
		return 0, err
	}
	return chatID, nil
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

func ChatExists121ByUsers(uid int, uid2 int) (bool, error) {
	query := `SELECT EXISTS(
			SELECT 1 
			FROM chats c 
			JOIN chats_users cu ON cu.chat_id=c.id
			JOIN chats_users cu2 ON cu2.chat_id=c.id
			WHERE c.is_group=false AND cu.user_id=$1 AND cu2.user_id=$2 )`
	var exists bool

	err := DB.Get(&exists, query, uid, uid2)
	return exists, err
}

func ChatExistsByID(chatID uint64) (bool, error) {
	var exists bool
	err := DB.Get(&exists, "SELECT EXISTS (SELECT 1 FROM chats WHERE id=$1)", chatID)
	return exists, err
}

func GetMessages(chatID uint64) ([]chatsModels.Message, error) {
	var messagesList []chatsModels.Message
	err := DB.Select(&messagesList, "SELECT m.id,u.name,m.chat_id,m.user_id,m.content,m.created_at FROM messages m JOIN users u ON m.user_id=u.id WHERE chat_id=$1", chatID)
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
				(user_id,chat_id,title,can_delete_messages,can_ban_users,can_edit_chat_info,can_manage_roles,can_change_avatar) 
				VALUES (:user_id,:chat_id,:title,:can_delete_messages,:can_ban_users,:can_edit_chat_info,:can_manage_roles,:can_change_avatar)`, &Admin)
	return err
}

// check have user roots for doing X
func CanUserX(uid int, chatid int, action string) (bool, error) {
	allowedActions := map[string]bool{
		"can_delete_messages": true,
		"can_ban_users":       true,
		"can_edit_chat_info":  true,
		"can_manage_roles":    true,
		"can_change_avatar":   true,
	}

	if !allowedActions[action] {
		return false, fmt.Errorf("invalid action")
	}

	query := fmt.Sprintf(`SELECT %s FROM chats_roles WHERE user_id=$1 AND chat_id=$2`, action)
	var exists bool
	if err := DB.Get(&exists, query, uid, chatid); err != nil {
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
