const token = localStorage.getItem('token');
if (!token) {
    window.location.href = 'login.html';
}

const searchInput = document.getElementById('searchUserInput');
const searchResults = document.getElementById('searchResults');
const selectedUsersList = document.getElementById('selectedUsers');
const createGroupBtn = document.getElementById('createGroupBtn');
const backBtn = document.getElementById('backBtn');
const groupNameInput = document.getElementById('groupName');

let selectedUsers = [];

// Search users
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
        searchResults.innerHTML = '';

        if (response.ok && data.data) {
            data.data.forEach(user => {
                const li = document.createElement('li');
                li.textContent = user.username || user.name || user.email;
                li.dataset.userId = user.id;

                li.addEventListener('click', () => {
                    if (!selectedUsers.find(u => u.id === user.id)) {
                        selectedUsers.push({ id: user.id, name: li.textContent });
                        updateSelectedUsersUI();
                        li.classList.add('selected');
                    }
                });

                searchResults.appendChild(li);
            });
        }
    } catch (err) {
        console.error(err);
    }
});

// Update selected users UI
function updateSelectedUsersUI() {
    selectedUsersList.innerHTML = '';
    selectedUsers.forEach(u => {
        const li = document.createElement('li');
        li.textContent = u.name;
        li.addEventListener('click', () => {
            selectedUsers = selectedUsers.filter(su => su.id !== u.id);
            updateSelectedUsersUI();

            // Remove highlight in search results
            const searchLi = Array.from(searchResults.children).find(li => li.dataset.userId == u.id);
            if (searchLi) searchLi.classList.remove('selected');
        });
        selectedUsersList.appendChild(li);
    });
}

// Create group
createGroupBtn.addEventListener('click', async () => {
    const groupName = groupNameInput.value.trim();
    if (!groupName) {
        alert('Enter a group name');
        return;
    }

    if (selectedUsers.length === 0) {
        alert('Select at least one user');
        return;
    }

    try {
        const response = await fetch('http://localhost:8080/createChat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: groupName,
                is_group: true,
                users: selectedUsers.map(u => u.id)
            })
        });

        const data = await response.json();
        if (response.ok) {
            alert('Group created!');
            window.location.href = 'chats.html'; // Возврат к списку чатов
        } else {
            alert(data.message || 'Failed to create group');
        }
    } catch (err) {
        console.error(err);
    }
});

// Back button
backBtn.addEventListener('click', () => {
    window.location.href = 'chats.html';
});
