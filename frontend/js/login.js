const loginForm = document.getElementById('loginForm');
const messageDiv = document.getElementById('message');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const response = await fetch('http://localhost:8080/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (response.ok) {
        messageDiv.style.color = 'green';
        messageDiv.textContent = 'Login successful!';
        // Сохраняем JWT и редиректим на чат
        localStorage.setItem('token', data.data);
        setTimeout(() => {
            window.location.href = 'chats.html';
        }, 1000);
    } else {
        messageDiv.style.color = 'red';
        messageDiv.textContent = data.message || 'Login failed';
    }
});
