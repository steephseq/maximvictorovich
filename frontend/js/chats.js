const chatList = document.getElementById('chatList');
const logoutBtn = document.getElementById('logoutBtn');
const createGroupBtn = document.getElementById('createGroupBtn');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

const token = localStorage.getItem('token');
if (!token) {
    window.location.href = 'login.html';
}

// Функция получения отображаемого имени чата
function getChatName(chat) {
    return chat.name?.String || chat.name || '';
}

// Получаем список чатов
async function loadChats() {
    try {
        const response = await fetch('http://localhost:8080/chats', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            chatList.innerHTML = '';
            data.data.forEach(chat => {
                const li = document.createElement('li');
                const chatName = getChatName(chat);
                li.textContent = chatName;
                li.dataset.chatId = chat.id;
                li.dataset.isGroup = chat.is_group;
                li.addEventListener('click', () => {
                    window.location.href = `chat.html?id=${chat.id}&is_group=${chat.is_group}&name=${encodeURIComponent(chatName)}`;
                });
                chatList.appendChild(li);
            });
        } else {
            alert(data.message || 'Failed to load chats');
        }
    } catch (err) {
        console.error(err);
    }
}

// Logout
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
});

// Кнопка создания группы
createGroupBtn.addEventListener('click', () => {
    window.location.href = 'createGroup.html';
});

// Поиск пользователей
searchInput.addEventListener('input', async () => {
    const query = searchInput.value.trim();
    if (!query) {
        searchResults.innerHTML = '';
        return;
    }

    try {
        const response = await fetch('http://localhost:8080/searchUser', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ query })
        });

        const data = await response.json();
        if (response.ok && data.data) {
            searchResults.innerHTML = '';
            data.data.forEach(user => {
                const li = document.createElement('li');
                li.textContent = user.username || user.name || user.email;
                li.dataset.userId = user.id;

                li.addEventListener('click', async () => {
                    const userId = user.id;

                    // Проверяем, существует ли чат
                    const existsResp = await fetch('http://localhost:8080/chatExists', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ user_id: userId })
                    });

                    const existsData = await existsResp.json();
                    let chatID;

                    if (existsResp.ok && existsData.message === 'chat already exists') {
                        // Получаем список чатов и ищем по имени
                        const chatsResp = await fetch('http://localhost:8080/chats', {
                            method: 'GET',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        const chatsData = await chatsResp.json();

                        const chat = chatsData.data.find(c => {
                            return getChatName(c) === (user.username || user.name || '');
                        });

                        if (!chat) {
                            alert('Chat not found for this user');
                            return;
                        }

                        chatID = chat.id;
                    } else {
                        // Создаем новый 1:1 чат
                        const createResp = await fetch('http://localhost:8080/create121Chat', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ user_id: userId })
                        });
                        const createData = await createResp.json();
                        chatID = createData.data?.chat_id;
                    }

                    if (chatID) {
                        window.location.href = `chat.html?id=${chatID}&is_group=false`;
                    } else {
                        alert('Failed to open chat');
                    }
                });

                searchResults.appendChild(li);
            });
        } else {
            searchResults.innerHTML = '';
        }
    } catch (err) {
        console.error(err);
    }
});

// Инициализация
loadChats();
