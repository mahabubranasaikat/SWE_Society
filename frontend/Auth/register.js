const API_BASE_URL = `${window.location.origin}/api`;

document.addEventListener('DOMContentLoaded', function() {
    const authForm = document.getElementById('authForm');
    const registerBtn = document.getElementById('registerBtn');
    const btnText = document.getElementById('btnText');
    const spinner = document.getElementById('spinner');
    const alertDiv = document.getElementById('alert');

    authForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const name = document.getElementById('name').value.trim();
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!name || !username || !email || !password || !confirmPassword) {
            showAlert('Please fill in all fields', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showAlert('Passwords do not match', 'error');
            return;
        }

        if (password.length < 6) {
            showAlert('Password must be at least 6 characters long', 'error');
            return;
        }

        // Show loading state
        registerBtn.disabled = true;
        btnText.textContent = 'Creating Account...';
        spinner.style.display = 'block';

        try {
            const response = await fetch(`${API_BASE_URL}/profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name,
                    username: username,
                    email: email,
                    password: password
                })
            });

            const data = await response.json(); // Parse the response data

            if (response.ok && data.success) {
                localStorage.setItem('Swe_Society_token', data.token);
                localStorage.setItem('Swe_Society_user', JSON.stringify(data.data));
                showAlert('Account created successfully! Redirecting to login...', 'success');

                // Redirect to login page after short delay
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
            } else {
                showAlert(data.message || 'Registration failed', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            showAlert('Network error. Please try again.', 'error');
        } finally {
            // Reset loading state
            registerBtn.disabled = false;
            btnText.textContent = 'Create Account';
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