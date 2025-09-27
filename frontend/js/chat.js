const urlParams = new URLSearchParams(window.location.search);
const currentChatId = urlParams.get("id");
const isGroup = urlParams.get("is_group") === "true";
const chatName = decodeURIComponent(urlParams.get("name") || "");

const token = localStorage.getItem("token");
if (!token) window.location.href = "login.html";
if (!currentChatId) {
    console.error("chat id missing in URL");
    window.location.href = "chats.html";
}

// DOM элементы
const messagesContainer = document.getElementById("messages");
const chatTitle = document.getElementById("chatTitle");
const backBtn = document.getElementById("backBtn");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

chatTitle.textContent = chatName || (isGroup ? "Group chat" : "Chat");

// --- Открытие профиля через POST ---
async function openProfile(chatId, isGroup) {
    try {
        const resp = await fetch('http://localhost:8080/profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ ID: parseInt(chatId), Is_group: isGroup })
        });

        const json = await resp.json();
        if (resp.ok) {
            console.log('Profile data:', json.data);
            // Здесь можешь показать модальное окно или перенаправить:
             window.location.href = `profile.html?id=${chatId}&is_group=${isGroup}`;
        } else {
            alert(json.message || 'Failed to open profile');
        }
    } catch (err) {
        console.error('Open profile error', err);
    }
}

// Клик по заголовку чата
chatTitle.style.cursor = "pointer";
chatTitle.addEventListener("click", () => openProfile(currentChatId, isGroup));

backBtn.addEventListener("click", () => {
    window.location.href = "chats.html";
});

// helper для получения текущего user id из JWT
function parseJWTGetId(token) {
    try {
        const payload = token.split('.')[1];
        const json = atob(payload.replace(/-/g,'+').replace(/_/g,'/'));
        return JSON.parse(json).id;
    } catch (e) {
        return null;
    }
}
const myUserId = parseJWTGetId(token);

// WebSocket
const wsScheme = location.protocol === 'https:' ? 'wss' : 'ws';
const wsUrl = `${wsScheme}://${location.hostname}:8080/ws?id=${currentChatId}&token=${token}`;
let ws;

function openWS() {
    ws = new WebSocket(wsUrl);

    ws.addEventListener("open", () => console.log("WS open", wsUrl));

    ws.addEventListener("message", (evt) => {
        try {
            const msg = JSON.parse(evt.data);
            if (msg?.id && document.querySelector(`[data-message-id="${msg.id}"]`)) return;
            appendMessage(msg);
        } catch (err) {
            console.error("WS message parse error", err);
        }
    });

    ws.addEventListener("close", () => {
        console.log("WS closed, reconnect in 1s");
        setTimeout(openWS, 1000);
    });

    ws.addEventListener("error", (e) => {
        console.error("WS error", e);
        ws.close();
    });
}
openWS();

// загрузка истории сообщений
async function loadMessages() {
    try {
        const resp = await fetch(`http://localhost:8080/messages?id=${currentChatId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        if (!resp.ok) {
            console.error("Failed to load messages", data);
            return;
        }
        messagesContainer.innerHTML = "";
        if (Array.isArray(data.data)) data.data.forEach(m => appendMessage(m));
        scrollToBottom();
    } catch (err) {
        console.error("Load messages error", err);
    }
}

// создание DOM для сообщений
function appendMessage(msg) {
    if (!msg || (msg.id && document.querySelector(`[data-message-id="${msg.id}"]`))) return;

    const wrapper = document.createElement("div");
    wrapper.classList.add("message");
    if (msg.user_id !== undefined) {
        wrapper.classList.add(msg.user_id === myUserId ? "self" : "other");
    } else if (msg.is_self) {
        wrapper.classList.add(msg.is_self ? "self" : "other");
    }
    if (msg.id !== undefined) wrapper.dataset.messageId = msg.id;

    // Автор
    const author = document.createElement("div");
    author.className = "message-author";
    author.textContent = msg.name || msg.username || "";
    author.style.cursor = "pointer";
    author.addEventListener("click", () => {
        if (!isGroup && msg.user_id) openProfile(msg.user_id, false);
    });

    // Текст
    const text = document.createElement("span");
    text.className = "message-text";
    text.textContent = msg.content ?? msg.text ?? "";

    // Левая часть (автор + текст + фото)
    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.flexDirection = "column";
    left.appendChild(author);
    left.appendChild(text);

    if (msg.photo_url) {
        const img = document.createElement("img");
        img.src = msg.photo_url;
        img.style.maxWidth = "200px";
        img.style.borderRadius = "8px";
        img.style.marginTop = "6px";
        left.appendChild(img);
    }

    // Правая часть (время + меню)
    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "8px";

    if (msg.created_at) {
        const t = document.createElement("small");
        t.className = "message-time";
        t.textContent = new Date(msg.created_at).toLocaleTimeString();
        right.appendChild(t);
    }

    const menuBtn = document.createElement("span");
    menuBtn.className = "menu-btn";
    menuBtn.textContent = "⋮";
    menuBtn.title = "Actions";
    menuBtn.style.userSelect = "none";
    menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showMessageMenu(e, msg.id);
    });
    right.appendChild(menuBtn);

    wrapper.appendChild(left);
    wrapper.appendChild(right);
    messagesContainer.appendChild(wrapper);
    scrollToBottom();
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Show actions menu for message (queries backend for allowed actions)
// Show actions menu for message (queries backend for allowed actions)
async function showMessageMenu(e, messageId) {
    try {
        const resp = await fetch(`http://localhost:8080/howCanIDoMessage?id=${currentChatId}&mid=${messageId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await resp.json();

        let actions = [];
        if (json && json.data) {
            if (Array.isArray(json.data)) actions = json.data;
            else if (typeof json.data === 'object') actions = Object.keys(json.data);
        }

        // === Маппинг названий ===
        const actionLabels = {
            "delete": "Удалить",
            "can_delete_message": "Удалить",
            "edit": "Редактировать",
            "can_edit_message": "Редактировать",
            "copy": "Скопировать",
            "can_copy_message": "Скопировать"
        };

        // убрать старое меню
        const existing = document.getElementById('msg-action-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.id = 'msg-action-menu';
        menu.style.position = 'absolute';
        menu.style.zIndex = 9999;
        menu.style.background = '#fff';
        menu.style.border = '1px solid #ccc';
        menu.style.borderRadius = '6px';
        menu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
        menu.style.padding = '6px 4px';

        const left = e.clientX + 8;
        const top = e.clientY + 8;
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;

        if (actions.length === 0) {
            const p = document.createElement('div');
            p.textContent = 'Нет действий';
            p.style.padding = '6px 10px';
            menu.appendChild(p);
        } else {
            actions.forEach(action => {
                const label = actionLabels[action] || action;
                const btn = document.createElement('button');
                btn.textContent = label;
                btn.style.display = 'block';
                btn.style.padding = '6px 12px';
                btn.style.width = '100%';
                btn.style.border = 'none';
                btn.style.background = 'transparent';
                btn.style.cursor = 'pointer';

                btn.addEventListener('click', async (ev) => {
                    ev.stopPropagation();
                    if (label === "Удалить") {
                        await doDeleteMessage(messageId);
                    } else if (label === "Редактировать") {
                        const newText = prompt('Изменить сообщение:');
                        if (newText !== null) await doEditMessage(messageId, newText);
                    } else if (label === "Скопировать") {
                        const el = document.querySelector(`[data-message-id="${messageId}"] .message-text`);
                        if (el) {
                            await navigator.clipboard.writeText(el.textContent);
                            alert("Сообщение скопировано!");
                        }
                    } else {
                        alert('Действие: ' + label);
                    }
                    menu.remove();
                });

                menu.appendChild(btn);
            });
        }

        document.body.appendChild(menu);

        // закрытие по клику вне
        const onDocClick = (ev) => {
            if (!menu.contains(ev.target)) {
                menu.remove();
                document.removeEventListener('click', onDocClick);
            }
        };
        document.addEventListener('click', onDocClick);
    } catch (err) {
        console.error("Failed to get actions", err);
    }
}


// Удаление сообщения
async function doDeleteMessage(messageId) {
    try {
        const resp = await fetch("http://localhost:8080/deleteMessage", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                chat_id: parseInt(currentChatId),
                message_id: messageId,
                action: "can_delete_messages"
            })
        });

        const data = await resp.json();
        if (resp.ok) {
            // Убираем сообщение из DOM
            const msgEl = document.querySelector(`[data-message-id="${messageId}"]`);
            if (msgEl) msgEl.remove();
        } else {
            alert(data.message || "Ошибка при удалении");
        }
    } catch (err) {
        console.error("Delete failed", err);
    }
}


async function doEditMessage(messageId, newText) {
    try {
        const resp = await fetch(`http://localhost:8080/editMessage`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ chat_id: parseInt(currentChatId), message_id: messageId, text: newText })
        });
        const json = await resp.json().catch(() => ({}));
        if (resp.ok) {
            // Update UI if message exists
            const el = document.querySelector(`[data-message-id="${messageId}"]`);
            if (el) {
                const span = el.querySelector('.message-text');
                if (span) span.textContent = newText;
            }
        } else {
            alert(json.message || 'Failed to edit');
        }
    } catch (err) {
        console.error('Edit error', err);
    }
}

// Отправка сообщения — через WebSocket
messageForm && messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = messageInput.value.trim();
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    if (!text && !file) return; // ничего не отправляем

    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn('WS not open, message not sent');
        return;
    }

    if (file) {
        // создаём FormData для отправки файла через HTTP
        const formData = new FormData();
        formData.append("file", file);
        formData.append("chat_id", currentChatId);

        try {
            const resp = await fetch(`http://localhost:8080/uploadPhoto`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            });

            const data = await resp.json();
            if (resp.ok && data.url) {
                // отправляем через WS ссылку на фото
                ws.send(JSON.stringify({ content: text, photo_url: data.url }));
            } else {
                alert("Failed to upload photo");
            }
        } catch (err) {
            console.error("Photo upload error", err);
        }

        fileInput.value = ""; // сброс выбранного файла
    } else {
        // обычное текстовое сообщение
        ws.send(JSON.stringify({ content: text }));
    }

    messageInput.value = "";
});


// init
loadMessages();
