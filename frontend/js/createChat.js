const API_BASE = "http://localhost:8080"; // твой бэкенд
const token = localStorage.getItem("jwt");

const searchInput = document.getElementById("searchUserInput");
const userListDiv = document.getElementById("userList");

if (!searchInput || !userListDiv) {
    console.error("Не найден search input или userList div");
}

// =================== ПОИСК ЮЗЕРОВ ===================
searchInput.addEventListener("input", async () => {
    const query = searchInput.value.trim();
    if (!query) {
        userListDiv.innerHTML = "";
        return;
    }

    try {
        const resp = await fetch(`${API_BASE}/searchUser`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ query })
        });

        const data = await resp.json();
        userListDiv.innerHTML = "";

        if (data.code === 200 && data.data) {
            const users = Array.isArray(data.data) ? data.data : [data.data]; // массив или один объект

            users.forEach(user => {
                const div = document.createElement("div");
                div.className = "user-result";
                div.textContent = `${user.username} (${user.name || "No name"})`;
                div.style.cursor = "pointer";

                // =================== КЛИК НА ЮЗЕРА ===================
                div.addEventListener("click", async () => {
                    try {
                        const respCreate = await fetch(`${API_BASE}/createChat121`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${token}`
                            },
                            body: JSON.stringify({ user_id: parseInt(user.id) }) // важно parseInt
                        });

                        const createData = await respCreate.json();
                        if (createData.code === 200 && createData.data && createData.data.chat_id) {
                            const chatId = createData.data.chat_id;
                            window.location.href = `/chat.html?id=${chatId}`;
                        } else {
                            alert("Не удалось создать чат");
                        }
                    } catch (err) {
                        console.error("Ошибка при создании чата:", err);
                        alert("Ошибка при создании чата");
                    }
                });

                userListDiv.appendChild(div);
            });
        } else {
            userListDiv.textContent = "No users found";
        }
    } catch (err) {
        console.error("Ошибка поиска пользователей:", err);
        userListDiv.textContent = "Error loading users";
    }
});
