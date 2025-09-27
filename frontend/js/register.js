const registerForm = document.getElementById('registerForm');
const messageDiv = document.getElementById('message');

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const response = await fetch('http://localhost:8080/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, name, email, password })
    });

    const data = await response.json();
    if (response.ok) {
        messageDiv.style.color = 'green';
        messageDiv.textContent = 'Registration successful! Redirecting to login...';
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
    } else {
        messageDiv.style.color = 'red';
        messageDiv.textContent = data.message || 'Registration failed';
    }
});
