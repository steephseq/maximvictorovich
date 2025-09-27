const token = localStorage.getItem('token');
if (!token) window.location.href = 'login.html';

const urlParams = new URLSearchParams(window.location.search);
const profileId = parseInt(urlParams.get('id'));
const isGroup = urlParams.get('is_group') === 'true';
const chatNameFromList = decodeURIComponent(urlParams.get('name') || '');

const backBtn = document.getElementById('backBtn');
const profileTitle = document.getElementById('profileTitle');
const profileContent = document.getElementById('profileContent');

const searchUserInput = document.getElementById('searchUserInput');
const searchResults = document.getElementById('searchResults');
const selectedUsersList = document.getElementById('selectedUsersList');
const addUsersBtn = document.getElementById('addUsersBtn');
const addUsersMessage = document.getElementById('addUsersMessage');

const removeUsersSection = document.getElementById('removeUsersSection');
const removeUsersList = document.getElementById('removeUsersList');
const removeUsersBtn = document.getElementById('removeUsersBtn');
const removeUsersMessage = document.getElementById('removeUsersMessage');

const groupAvatarImg = document.getElementById("groupAvatarImg");
const changeAvatarBtn = document.getElementById("changeAvatarBtn");
const avatarInput = document.createElement("input");
avatarInput.type = "file";
avatarInput.accept = "image/*";

let selectedUsers = [];
let chatMembers = [];

// --- Назад ---
backBtn.addEventListener('click', () => window.location.href = 'chats.html');

// --- Инициализация ---
loadProfile();

// --- Загрузка профиля ---
async function loadProfile() {
    try {
        const response = await fetch('http://localhost:8080/profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id: profileId, is_group: isGroup })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to load profile');

        renderProfile(data.data);
    } catch (err) {
        console.error(err);
    }
}

// --- Рендер профиля ---
function renderProfile(profile) {
    profileTitle.textContent = chatNameFromList || profile.name?.String || profile.name;

    if (profile.avatar_url) groupAvatarImg.src = profile.avatar_url;

    if (isGroup) {
        chatMembers = profile.members || [];
        profileContent.innerHTML = `
            <p>Group members: ${chatMembers.length}</p>
            <ul>${chatMembers.map(u => `<li>${u.name}</li>`).join('')}</ul>
        `;
        document.getElementById('addUsersSection').style.display = 'block';
        document.getElementById('removeUsersSection').style.display = 'block';
        renderRemoveUsersList();
        changeAvatarBtn.style.display = 'inline-block';
    } else {
        profileContent.innerHTML = `
            <p>Username: ${profile.username}</p>
            <p>Bio: ${profile.bio?.String || profile.bio}</p>
        `;
        document.getElementById('addUsersSection').style.display = 'none';
        document.getElementById('removeUsersSection').style.display = 'none';
        changeAvatarBtn.style.display = 'none';
    }
}

// --- Загрузка аватара группы ---
changeAvatarBtn.addEventListener("click", () => avatarInput.click());

avatarInput.addEventListener("change", async () => {
    const file = avatarInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);            // файл
    formData.append("owner_type", "chat");      // строго как Go ожидает
    formData.append("owner_id", profileId);     // ID группы

    try {
        const resp = await fetch("http://localhost:8080/setAvatar", {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
            body: formData
        });

        const data = await resp.json();
        if (resp.ok && data.data?.url) {
            alert("Аватар обновлён!");
            groupAvatarImg.src = data.data.url;
        } else {
            alert(data.message || "Ошибка при загрузке аватара");
        }
    } catch (err) {
        console.error("Avatar upload error", err);
        alert("Ошибка при загрузке аватара");
    } finally {
        avatarInput.value = "";
    }
});

// --- Поиск пользователей для добавления ---
searchUserInput.addEventListener('input', async () => {
    const query = searchUserInput.value.trim();
    if (!query) return searchResults.innerHTML = '';

    try {
        const resp = await fetch('http://localhost:8080/searchUser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ query })
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message);

        searchResults.innerHTML = '';
        data.data.forEach(u => {
            if (chatMembers.find(m => m.id === u.id)) return;
            const li = document.createElement('li');
            li.textContent = u.username || u.name || u.email;
            li.dataset.userId = u.id;
            li.addEventListener('click', () => selectUser(u));
            searchResults.appendChild(li);
        });
    } catch (err) {
        console.error(err);
    }
});

// --- Выбор пользователей для добавления ---
function selectUser(user) {
    if (selectedUsers.find(u => u.id === user.id)) return;
    selectedUsers.push(user);
    renderSelectedUsers();
}

function renderSelectedUsers() {
    selectedUsersList.innerHTML = '';
    selectedUsers.forEach(u => {
        const li = document.createElement('li');
        li.textContent = u.username || u.name || u.email;
        li.addEventListener('click', () => {
            selectedUsers = selectedUsers.filter(s => s.id !== u.id);
            renderSelectedUsers();
        });
        selectedUsersList.appendChild(li);
    });
}

// --- Добавление пользователей в чат ---
addUsersBtn.addEventListener('click', async () => {
    if (!selectedUsers.length) return;
    try {
        const resp = await fetch('http://localhost:8080/addUsers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ chat_id: profileId, users: selectedUsers.map(u => u.id) })
        });
        const data = await resp.json();

        if (!resp.ok) throw new Error(data.message || 'Failed');

        const added = data.data.added || [];
        const alreadyExists = data.data.alreadyExists || [];

        addUsersMessage.textContent = added.length ? `Added: ${added.length}` : '';
        if (alreadyExists.length) addUsersMessage.textContent += ` Already exists: ${alreadyExists.length}`;

        selectedUsers = [];
        renderSelectedUsers();
        loadProfile();
    } catch (err) {
        console.error(err);
        addUsersMessage.textContent = 'Error adding users';
    }
});

// --- Рендер списка для удаления ---
function renderRemoveUsersList() {
    removeUsersList.innerHTML = '';
    chatMembers.forEach(u => {
        const li = document.createElement('li');
        li.textContent = u.name;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.userId = u.id;
        li.prepend(checkbox);
        removeUsersList.appendChild(li);
    });
}

// --- Удаление выбранных пользователей ---
removeUsersBtn.addEventListener('click', async () => {
    const selectedIds = Array.from(removeUsersList.querySelectorAll('input:checked')).map(i => parseInt(i.dataset.userId));
    if (!selectedIds.length) return;

    try {
        const resp = await fetch('http://localhost:8080/removeUserFromChat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ chat_id: profileId, users: selectedIds })
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message);

        removeUsersMessage.textContent = `Removed: ${selectedIds.length}`;
        loadProfile();
    } catch (err) {
        console.error(err);
        removeUsersMessage.textContent = 'Error removing users';
    }
});
