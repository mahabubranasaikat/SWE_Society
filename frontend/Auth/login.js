const API_BASE_URL = `${window.location.origin}/api`;

document.addEventListener('DOMContentLoaded', function() {
    const authForm = document.getElementById('authForm');
    const loginBtn = document.getElementById('loginBtn');
    const btnText = document.getElementById('btnText');
    const spinner = document.getElementById('spinner');
    const alertDiv = document.getElementById('alert');

    authForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const emailOrUsername = document.getElementById('emailOrUsername').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!emailOrUsername || !password) {
            showAlert('Please fill in all fields', 'error');
            return;
        }

        // Show loading state
        loginBtn.disabled = true;
        btnText.textContent = 'Logging in...';
        spinner.style.display = 'block';

        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    emailOrUsername: emailOrUsername,
                    password: password
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Store token and user data
                localStorage.setItem('Swe_Society_token', data.token);
                localStorage.setItem('Swe_Society_user', JSON.stringify(data.data));

                showAlert('Login successful! Redirecting...', 'success');

                // Redirect to home page after short delay
                setTimeout(() => {
                    window.location.href = '/home.html';
                }, 1000);
            } else {
                showAlert(data.message || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showAlert('Network error. Please try again.', 'error');
        } finally {
            // Reset loading state
            loginBtn.disabled = false;
            btnText.textContent = 'Login';
            spinner.style.display = 'none';
        }
    });

    function showAlert(message, type) {
        alertDiv.textContent = message;
        alertDiv.className = `alert ${type}`;
        alertDiv.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            alertDiv.style.display = 'none';
        }, 5000);
    }
});