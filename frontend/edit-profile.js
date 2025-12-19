const API_BASE_URL = `${window.location.origin}/api`;

// Load auth manager
let authManager;
try {
    authManager = window.authManager;
} catch (e) {
    authManager = {
        getToken: () => localStorage.getItem('Swe_Society_token'),
        getUserData: () => {
            const data = localStorage.getItem('Swe_Society_user');
            return data ? JSON.parse(data) : null;
        },
        logout: () => {
            localStorage.removeItem('Swe_Society_token');
            localStorage.removeItem('Swe_Society_user');
            localStorage.removeItem('userId');
        },
        authenticatedFetch: async (url, options = {}) => {
            const token = authManager.getToken();
            const config = {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                }
            };
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            const response = await fetch(url, config);
            if (response.status === 401) {
                authManager.logout();
                window.location.href = '/auth/login.html';
            }
            return response;
        }
    };
}

// Get elements
const loadingState = document.getElementById('loadingState');
const form = document.getElementById('editProfileForm');
const updateBtn = document.getElementById('updateBtn');
const deleteBtn = document.getElementById('deleteBtn');
const btnText = updateBtn.querySelector('.btn-text');
const spinner = updateBtn.querySelector('.spinner');
const alertMessage = document.getElementById('alertMessage');
const deleteModal = document.getElementById('deleteModal');
const cancelDelete = document.getElementById('cancelDelete');
const confirmDelete = document.getElementById('confirmDelete');

// Profile info display elements
const displayUserId = document.getElementById('displayUserId');
const displayTotalPosts = document.getElementById('displayTotalPosts');
const displayCreatedAt = document.getElementById('displayCreatedAt');

// Form fields
const fields = {
    username: document.getElementById('username'),
    name: document.getElementById('name'),
    email: document.getElementById('email'),
    password: document.getElementById('password'),
    phone: document.getElementById('phone'),
    organization: document.getElementById('organization'),
    github_url: document.getElementById('github_url'),
    linkedin_url: document.getElementById('linkedin_url')
};

let userId = null;
let originalData = {};
let modifiedFields = new Set();
let availableRoles = {};
let selectedRoles = [];
let currentUserRoles = [];
let rolesDirty = false;

function computeRolesDirty() {
    const selectedRoleIds = Array.from(document.querySelectorAll('.role-input:checked')).map(i => parseInt(i.value));
    // Sort both arrays for proper comparison
    const sortedSelected = selectedRoleIds.sort((a, b) => a - b);
    const sortedCurrent = currentUserRoles.sort((a, b) => a - b);
    const sameLength = sortedSelected.length === sortedCurrent.length;
    const sameSet = sameLength && sortedSelected.every((id, idx) => id === sortedCurrent[idx]);
    rolesDirty = !sameSet;
    console.log('Roles dirty check:', { selectedRoleIds, currentUserRoles, rolesDirty });
    updateUpdateButtonText();
    return rolesDirty;
}

function updateUpdateButtonText() {
    if (!btnText) return;
    if (modifiedFields.size > 0 && rolesDirty) {
        btnText.textContent = `Update Profile (${modifiedFields.size} field${modifiedFields.size > 1 ? 's' : ''} changed + roles)`;
    } else if (modifiedFields.size > 0) {
        btnText.textContent = `Update Profile (${modifiedFields.size} field${modifiedFields.size > 1 ? 's' : ''} changed)`;
    } else if (rolesDirty) {
        btnText.textContent = 'Update Profile (roles changed)';
    } else {
        btnText.textContent = 'Update Profile';
    }
}

// Get user ID from JWT token or URL
function getUserId() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlUserId = urlParams.get('userId');
    
    if (urlUserId) return urlUserId;
    
    // Get from JWT token
    const userData = authManager.getUserData();
    if (userData) return userData.userId;
    
    // Legacy fallback
    return localStorage.getItem('userId');
}

// Load profile data
async function loadProfile() {
    userId = getUserId();
    
    if (!userId) {
        showAlert('No user ID found. Please login first.', 'error');
        setTimeout(() => {
            window.location.href = '/auth/login.html';
        }, 2000);
        return;
    }
    
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/profile/${userId}`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            originalData = data.data;
            populateForm(data.data);
            loadingState.style.display = 'none';
            form.style.display = 'block';
        } else {
            if (response.status === 404) {
                showAlert('Profile not found. Please create a new profile.', 'error');
                setTimeout(() => {
                    window.location.href = 'create-profile.html';
                }, 2000);
            } else {
                showAlert('Failed to load profile. Please try again.', 'error');
            }
            loadingState.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showAlert('Network error. Please check your connection.', 'error');
        loadingState.style.display = 'none';
    }
}

// Populate form with profile data
function populateForm(data) {
    // Display profile info
    displayUserId.textContent = data.id;
    displayTotalPosts.textContent = data.total_posts;
    displayCreatedAt.textContent = new Date(data.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Populate form fields
    fields.username.value = data.username || '';
    fields.name.value = data.name || '';
    fields.email.value = data.email || '';
    fields.phone.value = data.phone || '';
    fields.organization.value = data.organization || '';
    fields.github_url.value = data.github_url || '';
    fields.linkedin_url.value = data.linkedin_url || '';
    fields.password.value = ''; // Never populate password
    
    // Load and display user roles
    if (data.id) {
        loadUserRoles(data.id);
    }
}

// Load available roles for the selector
async function loadAvailableRoles() {
    const container = document.getElementById('rolesContainer');

    const tryFetch = async (useAuth) => {
        const fetchFn = useAuth ? authManager.authenticatedFetch : fetch;
        const response = await fetchFn(`${API_BASE_URL}/roles/all`);
        let data = null;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error('Invalid response while loading roles');
        }
        if (response.ok && data && data.success && data.data) {
            return data.data;
        }
        throw new Error(data?.message || 'Failed to load roles');
    };

    try {
        // Try with auth header first, then fallback unauthenticated (route is public)
        availableRoles = await tryFetch(true)
            .catch(() => tryFetch(false));

        renderRolesSelector();
    } catch (error) {
        console.error('Error loading roles:', error);
        if (container) {
            container.innerHTML = '<div class="roles-error">Failed to load roles. Please refresh or try again.</div>';
        }
    }
}

// Load current user's roles
async function loadUserRoles(userId) {
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/roles/${userId}`);
        const data = await response.json();
        
        if (data.success && data.data) {
            currentUserRoles = data.data.map(role => role.id);
            selectedRoles = data.data.map(role => ({
                id: role.id,
                name: role.role_name
            }));
            
            // Update checkboxes to show currently selected roles
            document.querySelectorAll('.role-input').forEach(input => {
                const roleId = parseInt(input.value);
                input.checked = currentUserRoles.includes(roleId);
            });
            
            // After loading roles, recompute dirty state and reset to false
            rolesDirty = false;
            computeRolesDirty();
        }
    } catch (error) {
        console.error('Error loading user roles:', error);
    }
}

// Render roles as checkboxes grouped by category
function renderRolesSelector() {
    const container = document.getElementById('rolesContainer');
    
    let html = '';
    for (const [category, roles] of Object.entries(availableRoles)) {
        const categoryLabel = category
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        
        html += `<div class="roles-category">
                    <h4>${categoryLabel}</h4>
                    <div class="roles-grid">`;
        
        roles.forEach(role => {
            const isCommittee = category === 'committee';
            const isAvailable = role.is_available !== false;
            const currentCount = role.current_count || 0;
            const maxCount = role.max_count;
            const isUserRole = currentUserRoles.includes(role.id);
            
            // Show availability status for committee roles
            let availabilityText = '';
            if (isCommittee && maxCount) {
                if (role.role_name === 'Executive Member') {
                    availabilityText = `<span class="role-count">(${currentCount}/${maxCount} filled)</span>`;
                } else {
                    availabilityText = isAvailable 
                        ? `<span class="role-count available">✓ Available</span>` 
                        : `<span class="role-count unavailable">✗ Occupied</span>`;
                }
            }
            
            // Disable checkbox if role is not available and user doesn't already have it
            const shouldDisable = isCommittee && !isAvailable && !isUserRole;
            
            html += `<label class="role-checkbox ${shouldDisable ? 'disabled' : ''}">
                        <input type="checkbox" 
                               value="${role.id}" 
                               class="role-input" 
                               data-role-name="${role.role_name}"
                               data-category="${category}"
                               ${shouldDisable ? 'disabled' : ''}
                               ${isUserRole ? 'checked' : ''}>
                        <span class="role-label">
                            <strong>${role.role_name}</strong>
                            ${availabilityText}
                            ${role.description ? `<small>${role.description}</small>` : ''}
                        </span>
                    </label>`;
        });
        
        html += `</div></div>`;
    }
    
    container.innerHTML = html;
    
    // Attach change listeners
    document.querySelectorAll('.role-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const roleId = parseInt(e.target.value);
            const roleName = e.target.dataset.roleName;
            const category = e.target.dataset.category;
            
            if (e.target.checked) {
                // If trying to add a committee role, auto-uncheck any other selected committee role
                if (category === 'committee') {
                    const checkedCommitteeInputs = Array.from(document.querySelectorAll('.role-input[data-category="committee"]:checked'));
                    const otherChecked = checkedCommitteeInputs.filter(inp => inp !== e.target);
                    if (otherChecked.length > 0) {
                        // Auto-uncheck the previously selected committee role
                        const prev = otherChecked[0];
                        prev.checked = false;
                        const prevId = parseInt(prev.value);
                        selectedRoles = selectedRoles.filter(r => r.id !== prevId);
                        // So the UI updates consistently
                        const prevLabel = prev.closest('.role-checkbox');
                        if (prevLabel) prevLabel.style.opacity = '0.6';
                    }
                }
                
                // Add role to selection
                if (!selectedRoles.find(r => r.id === roleId)) {
                    selectedRoles.push({
                        id: roleId,
                        name: roleName
                    });
                }
                console.log('Role added:', roleName, '- Total roles:', selectedRoles.length);
            } else {
                // Remove role from selection
                selectedRoles = selectedRoles.filter(r => r.id !== roleId);
                console.log('Role removed:', roleName, '- Total roles:', selectedRoles.length);
            }
            
            // Recompute and show instant feedback
            computeRolesDirty();
            // Visual feedback: highlight the change
            const roleLabel = e.target.closest('.role-checkbox');
            if (roleLabel) {
                roleLabel.style.opacity = e.target.checked ? '1' : '0.6';
            }
        });
    });
    
    // If we have current user roles, re-apply them
    if (currentUserRoles.length > 0) {
        currentUserRoles.forEach(roleId => {
            const input = document.querySelector(`.role-input[value="${roleId}"]`);
            if (input) {
                input.checked = true;
            }
        });
    }
    // After initial render & re-apply, recompute dirty state
    computeRolesDirty();
}

// Track field changes
Object.keys(fields).forEach(fieldName => {
    const field = fields[fieldName];
    
    field.addEventListener('input', () => {
        if (fieldName === 'password') {
            // Password is always considered modified if it has a value
            if (field.value) {
                modifiedFields.add(fieldName);
                field.classList.add('modified');
            } else {
                modifiedFields.delete(fieldName);
                field.classList.remove('modified');
            }
        } else {
            const originalValue = originalData[fieldName] || '';
            const currentValue = field.value;
            
            if (currentValue !== originalValue) {
                modifiedFields.add(fieldName);
                field.classList.add('modified');
            } else {
                modifiedFields.delete(fieldName);
                field.classList.remove('modified');
            }
        }
        
        updateUpdateButtonText();
    });
});

// Validation function
function validateField(fieldName, field) {
    const value = field.value.trim();
    let errorMessage = '';
    
    if (value) {
        switch (fieldName) {
            case 'username':
                if (value.length < 3) {
                    errorMessage = 'Username must be at least 3 characters';
                } else if (!/^[a-zA-Z0-9_]+$/.test(value)) {
                    errorMessage = 'Username can only contain letters, numbers, and underscores';
                }
                break;
                
            case 'email':
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    errorMessage = 'Please enter a valid email address';
                }
                break;
                
            case 'password':
                if (value && value.length < 6) {
                    errorMessage = 'Password must be at least 6 characters';
                }
                break;
                
            case 'phone':
                if (value && !/^[0-9+\-\s()]+$/.test(value)) {
                    errorMessage = 'Please enter a valid phone number';
                }
                break;
                
            case 'github_url':
            case 'linkedin_url':
                if (value && !isValidURL(value)) {
                    errorMessage = 'Please enter a valid URL';
                }
                break;
        }
    }
    
    const errorSpan = document.getElementById(`${fieldName}-error`);
    if (errorSpan) {
        errorSpan.textContent = errorMessage;
    }
    
    return !errorMessage;
}

// URL validation helper
function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Show alert message
function showAlert(message, type) {
    alertMessage.textContent = message;
    alertMessage.className = `alert ${type}`;
    alertMessage.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            alertMessage.style.display = 'none';
        }, 5000);
    }
    
    alertMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Handle form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Determine roles changed state
    const selectedRoleIds = Array.from(document.querySelectorAll('.role-input:checked')).map(i => parseInt(i.value));
    const rolesChanged = !(selectedRoleIds.length === currentUserRoles.length && selectedRoleIds.every(id => currentUserRoles.includes(id)));

    if (modifiedFields.size === 0 && !rolesChanged) {
        showAlert('No changes to update', 'error');
        return;
    }
    
    // Validate modified fields
    let isValid = true;
    modifiedFields.forEach(fieldName => {
        if (!validateField(fieldName, fields[fieldName])) {
            isValid = false;
        }
    });
    
    if (!isValid) {
        showAlert('Please fix the errors before updating', 'error');
        return;
    }
    
    // Prepare update data (only modified fields)
    const updateData = {};
    modifiedFields.forEach(fieldName => {
        const value = fields[fieldName].value.trim();
        if (fieldName === 'password') {
            if (value) {
                updateData[fieldName] = value;
            }
        } else {
            updateData[fieldName] = value || null;
        }
    });
    
    // Show loading state
    updateBtn.disabled = true;
    btnText.textContent = 'Updating...';
    spinner.style.display = 'inline-block';
    
    try {
        let profilePatched = true;
        if (modifiedFields.size > 0) {
            const response = await authManager.authenticatedFetch(`${API_BASE_URL}/profile/${userId}`, {
                method: 'PATCH',
                body: JSON.stringify(updateData)
            });
            const data = await response.json();
            if (!(response.ok && data.success)) {
                profilePatched = false;
                if (response.status === 409) {
                    showAlert('Username or email already exists.', 'error');
                } else {
                    showAlert(data.message || 'Failed to update profile.', 'error');
                }
            }
        }

        // If profile updated (or there were no profile field changes), handle roles if changed
        if (profilePatched && rolesChanged) {
            try {
                console.log('Updating roles with IDs:', selectedRoleIds);
                const rolesResponse = await authManager.authenticatedFetch(
                    `${API_BASE_URL}/roles/${userId}/assign`,
                    {
                        method: 'POST',
                        body: JSON.stringify({ roleIds: selectedRoleIds })
                    }
                );
                
                if (!rolesResponse.ok) {
                    const errorData = await rolesResponse.json();
                    console.error('Failed to update roles:', errorData);
                    showAlert('Failed to update roles: ' + (errorData.message || 'Unknown error'), 'error');
                    return;
                } else {
                    console.log('Roles updated successfully');
                    // Reload user roles to sync checkboxes with DB
                    await loadUserRoles(userId);
                }
            } catch (error) {
                console.error('Error updating roles:', error);
                showAlert('Error updating roles: ' + error.message, 'error');
                return;
            }
        }

        if (profilePatched || rolesChanged) {
            showAlert('Profile updated successfully!', 'success');
            // Reload profile data and roles
            await loadProfile();
            // Reset state
            modifiedFields.clear();
            rolesDirty = false;
            Object.values(fields).forEach(field => field.classList.remove('modified'));
            updateUpdateButtonText();
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showAlert('Network error. Please try again.', 'error');
    } finally {
        updateBtn.disabled = false;
        spinner.style.display = 'none';
    }
});

// Delete account handlers
deleteBtn.addEventListener('click', () => {
    deleteModal.classList.add('active');
});

cancelDelete.addEventListener('click', () => {
    deleteModal.classList.remove('active');
});

confirmDelete.addEventListener('click', async () => {
    const deleteSpinner = confirmDelete.querySelector('.spinner');
    const deleteBtnText = confirmDelete.querySelector('.btn-text');
    
    confirmDelete.disabled = true;
    deleteBtnText.textContent = 'Deleting...';
    deleteSpinner.style.display = 'inline-block';
    
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/profile/${userId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            authManager.logout();
            alert('Account deleted successfully. You will be redirected to login.');
            window.location.href = '/auth/login.html';
        } else {
            alert('Failed to delete account: ' + (data.message || 'Unknown error'));
            deleteModal.classList.remove('active');
        }
    } catch (error) {
        console.error('Error deleting profile:', error);
        alert('Network error. Please try again.');
        deleteModal.classList.remove('active');
    } finally {
        confirmDelete.disabled = false;
        deleteBtnText.textContent = 'Yes, Delete My Account';
        deleteSpinner.style.display = 'none';
    }
});

// Close modal when clicking outside
deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
        deleteModal.classList.remove('active');
    }
});

// ==================== NAVBAR DROPDOWN FUNCTIONALITY ====================
function getInitials(name) {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function setupNavbarDropdown() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const logoutBtn = document.getElementById('logoutBtn');
    const userAvatar = document.getElementById('userAvatar');
    const navUserName = document.getElementById('navUserName');
    const navUserUsername = document.getElementById('navUserUsername');
    const notificationsBtn = document.getElementById('notificationsBtn');
    const notificationsDropdown = document.getElementById('notificationsDropdown');

    // Load user info for navbar
    const userData = authManager.getUserData();
    if (userData) {
        if (userAvatar) userAvatar.textContent = getInitials(userData.name);
        if (navUserName) navUserName.textContent = userData.name || 'User';
        if (navUserUsername) navUserUsername.textContent = `@${userData.username || 'user'}`;
    }

    // Toggle dropdown menu
    if (userMenuBtn) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenuBtn.classList.toggle('active');
            dropdownMenu.classList.toggle('show');
            // Close notifications dropdown if open
            if (notificationsDropdown) notificationsDropdown.classList.remove('show');
        });
    }

    // Toggle notifications dropdown
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationsDropdown.classList.toggle('show');
            // Close user dropdown if open
            if (userMenuBtn) userMenuBtn.classList.remove('active');
            if (dropdownMenu) dropdownMenu.classList.remove('show');
        });
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (userMenuBtn && !userMenuBtn.contains(e.target)) {
            userMenuBtn.classList.remove('active');
            dropdownMenu.classList.remove('show');
        }
        if (notificationsBtn && notificationsDropdown && !notificationsBtn.contains(e.target) && !notificationsDropdown.contains(e.target)) {
            notificationsDropdown.classList.remove('show');
        }
    });

    // Logout handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            authManager.logout();
            window.location.href = '/auth/login.html';
        });
    }
}

// Load profile on page load
window.addEventListener('DOMContentLoaded', () => {
    loadProfile();
    loadAvailableRoles();
    setupNavbarDropdown();
});
