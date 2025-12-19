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
            return fetch(url, config);
        }
    };
}

// Get elements
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const profileContent = document.getElementById('profileContent');
const editProfileBtn = document.getElementById('editProfileBtn');
const sendMessageBtn = document.getElementById('sendMessageBtn');

// Profile elements
const avatarInitials = document.getElementById('avatarInitials');
const profileName = document.getElementById('profileName');
const profileUsername = document.getElementById('profileUsername');
const positionBadge = document.getElementById('positionBadge');
const organizationBadge = document.getElementById('organizationBadge');
const profileEmail = document.getElementById('profileEmail');
const profilePhone = document.getElementById('profilePhone');
const profileOrganization = document.getElementById('profileOrganization');
const totalPosts = document.getElementById('totalPosts');
const memberSince = document.getElementById('memberSince');
const userId = document.getElementById('userId');

const phoneSection = document.getElementById('phoneSection');
const organizationSection = document.getElementById('organizationSection');
const socialSection = document.getElementById('socialSection');
const githubLink = document.getElementById('githubLink');
const linkedinLink = document.getElementById('linkedinLink');

const postCount = document.getElementById('postCount');
const postsLoading = document.getElementById('postsLoading');
const noPosts = document.getElementById('noPosts');
const postsGrid = document.getElementById('postsGrid');

let currentUserId = null;

// Get user ID from JWT token or URL
function getUserId() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlUserId = urlParams.get('userId');
    
    // If URL has userId, use that (viewing someone else's profile or own)
    if (urlUserId) return urlUserId;

    // Otherwise, show logged-in user's own profile
    const userData = authManager.getUserData();
    if (userData) return userData.userId;

    // Legacy fallback
    return localStorage.getItem('userId');
}

// Get current logged-in user ID
function getLoggedInUserId() {
    const userData = authManager.getUserData();
    if (userData) return userData.userId;
    return localStorage.getItem('userId');
}

// Check if viewing own profile
function isOwnProfile() {
    const profileUserId = getUserId();
    const loggedInUserId = getLoggedInUserId();
    return profileUserId && loggedInUserId && parseInt(profileUserId) === parseInt(loggedInUserId);
}

function getInitials(name) {
    const names = name.split(' ');
    if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format member since date
function formatMemberSince(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric'
    });
}

async function loadProfile() {
    currentUserId = getUserId();
    
    if (!currentUserId) {
        showError();
        return;
    }
    
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/profile/${currentUserId}`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            displayProfile(data.data);
            loadPosts();
        } else {
            showError();
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showError();
    }
}

// Display profile data
function displayProfile(profile) {
    // Hide loading, show content
    loadingState.style.display = 'none';
    profileContent.style.display = 'block';
    
    // Show/hide edit button based on whether viewing own profile
    if (editProfileBtn) {
        if (isOwnProfile()) {
            editProfileBtn.style.display = 'inline-flex';
            if (sendMessageBtn) sendMessageBtn.style.display = 'none';
        } else {
            editProfileBtn.style.display = 'none';
            if (sendMessageBtn) sendMessageBtn.style.display = 'inline-flex';
        }
    }
    
    // Set avatar initials
    avatarInitials.textContent = getInitials(profile.name);
    
    // Set profile info
    profileName.textContent = profile.name;
    profileUsername.textContent = profile.username;
    
    // Set position badge from first role if available
    if (profile.roles && profile.roles.length > 0) {
        // Use the first role's name as position
        const primaryRole = profile.roles.find(r => r.role_category === 'user_status') || profile.roles[0];
        positionBadge.textContent = primaryRole.role_name || 'Member';
    } else {
        positionBadge.textContent = 'Member';
    }
    
    // Set stats
    totalPosts.textContent = profile.total_posts || 0;
    memberSince.textContent = formatMemberSince(profile.created_at);
    userId.textContent = `#${profile.id}`;
    
    // Display roles if available
    if (profile.roles && profile.roles.length > 0) {
        displayRoles(profile.roles);
    }

    
    // Set contact info
    profileEmail.textContent = profile.email;
    
    // Phone (optional)
    if (profile.phone) {
        profilePhone.textContent = profile.phone;
        phoneSection.style.display = 'flex';
    }
    
    // Organization (optional)
    if (profile.organization) {
        profileOrganization.textContent = profile.organization;
        organizationSection.style.display = 'flex';
        organizationBadge.textContent = profile.organization;
    } else {
        organizationBadge.style.display = 'none';
    }
    
    // Social links (optional)
    let hasSocialLinks = false;
    
    if (profile.github_url) {
        githubLink.href = profile.github_url;
        githubLink.style.display = 'flex';
        hasSocialLinks = true;
    }
    
    if (profile.linkedin_url) {
        linkedinLink.href = profile.linkedin_url;
        linkedinLink.style.display = 'flex';
        hasSocialLinks = true;
    }
    
    if (hasSocialLinks) {
        socialSection.style.display = 'block';
    }
    
    // Display roles if available
    if (profile.roles && profile.roles.length > 0) {
        displayRoles(profile.roles);
    }
}

// Display user roles as labels
function displayRoles(roles) {
    const rolesSection = document.getElementById('rolesSection');
    const rolesContainer = document.getElementById('rolesContainer');
    
    if (!roles || roles.length === 0) {
        rolesSection.style.display = 'none';
        return;
    }
    
    // Clear existing roles
    rolesContainer.innerHTML = '';
    
    // Group roles by category
    const rolesByCategory = roles.reduce((acc, role) => {
        if (!acc[role.role_category]) {
            acc[role.role_category] = [];
        }
        acc[role.role_category].push(role);
        return acc;
    }, {});
    
    // Category display names and emojis
    const categoryInfo = {
        'system': { name: 'System', emoji: '⚙️' },
        'user_status': { name: 'Status', emoji: '👤' },
        'faculty': { name: 'Faculty', emoji: '🎓' },
        'committee': { name: 'Committee', emoji: '🏛️' },
        'financial': { name: 'Financial', emoji: '💰' },
        'team': { name: 'Team', emoji: '👥' },
        'sports': { name: 'Sports', emoji: '⚽' },
        'other': { name: 'Other', emoji: '🔖' }
    };
    
    // Display roles by category
    Object.keys(rolesByCategory).forEach(category => {
        const categoryRoles = rolesByCategory[category];
        const info = categoryInfo[category] || categoryInfo['other'];
        
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'role-category';
        
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'role-category-header';
        categoryHeader.innerHTML = `<span class="role-category-emoji">${info.emoji}</span> ${info.name}`;
        
        const rolesWrapper = document.createElement('div');
        rolesWrapper.className = 'role-labels';
        
        categoryRoles.forEach(role => {
            const roleLabel = document.createElement('span');
            roleLabel.className = `role-label role-${category}`;
            roleLabel.textContent = role.role_name;
            roleLabel.title = role.description || role.role_name;
            rolesWrapper.appendChild(roleLabel);
        });
        
        categoryDiv.appendChild(categoryHeader);
        categoryDiv.appendChild(rolesWrapper);
        rolesContainer.appendChild(categoryDiv);
    });
    
    rolesSection.style.display = 'block';
}

// Load user's posts
async function loadPosts() {
    postsLoading.style.display = 'block';
    
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/posts/user/${currentUserId}?limit=50`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            displayPosts(data.data);
        } else {
            postsLoading.style.display = 'none';
            noPosts.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading posts:', error);
        postsLoading.style.display = 'none';
        noPosts.style.display = 'block';
    }
}

// Display posts
function displayPosts(posts) {
    postsLoading.style.display = 'none';
    
    if (posts.length === 0) {
        noPosts.style.display = 'block';
        postCount.textContent = '0 posts';
        return;
    }
    
    postCount.textContent = `${posts.length} post${posts.length !== 1 ? 's' : ''}`;
    
    posts.forEach(post => {
        const postCard = createPostCard(post);
        postsGrid.appendChild(postCard);
    });
}

// Create post card
function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    
    // Privacy badge
    const privacyClass = post.privacy || 'public';
    
    // Tags
    const tags = post.tags ? post.tags.split(',').map(tag => tag.trim()) : [];
    const tagsHTML = tags.slice(0, 5).map(tag => 
        `<span class="tag">${tag}</span>`
    ).join('');
    
    // Description (truncate if too long)
    const description = post.description 
        ? (post.description.length > 120 
            ? post.description.substring(0, 120) + '...' 
            : post.description)
        : 'No description provided';
    
    // Date
    const createdDate = formatDate(post.created_at);
    
    card.innerHTML = `
        <div class="post-header">
            <h3>${post.name}</h3>
            <span class="privacy-badge ${privacyClass}">${privacyClass}</span>
        </div>
        <p>${description}</p>
        ${tags.length > 0 ? `<div class="post-tags">${tagsHTML}</div>` : ''}
        <div class="post-meta">
            <span>👍 ${post.likes_count || 0} likes</span>
            <span>💬 ${post.comments_count || 0} comments</span>
            <span>📅 ${createdDate}</span>
        </div>
        ${post.link ? `<a href="${post.link}" class="post-link" target="_blank">View Post →</a>` : ''}
    `;
    
    // Add click handler to navigate to post view
    card.addEventListener('click', (e) => {
        // Don't navigate if clicking on external links
        if (e.target.tagName === 'A' && e.target.hasAttribute('href')) {
            return;
        }
        window.location.href = `/post-view.html?id=${post.id}`;
    });
    
    return card;
}

// Show error state
function showError() {
    loadingState.style.display = 'none';
    errorState.style.display = 'block';
}

// Edit profile button handler
editProfileBtn.addEventListener('click', () => {
    window.location.href = `edit-profile.html?userId=${currentUserId}`;
});

// Send Message button handler
if (sendMessageBtn) {
    sendMessageBtn.addEventListener('click', async () => {
        try {
            const response = await authManager.authenticatedFetch(`${API_BASE_URL}/messages/start`, {
                method: 'POST',
                body: JSON.stringify({ targetUserId: currentUserId })
            });
            const data = await response.json();
            if (response.ok && data.success) {
                window.location.href = 'message.html';
            } else {
                alert(data.message || 'Unable to start conversation');
            }
        } catch (error) {
            console.error('Error starting conversation:', error);
            alert('Failed to start conversation');
        }
    });
}

// Load profile on page load
loadProfile();
initializeNotifications();

// Notification System (same as home.js)
let notificationsLoaded = false;
let unreadCount = 0;

function initializeNotifications() {
    const notificationsBtn = document.getElementById('notificationsBtn');
    const notificationsDropdown = document.getElementById('notificationsDropdown');
    const markAllReadBtn = document.getElementById('markAllRead');
    
    // Toggle notifications dropdown
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const isOpen = notificationsDropdown.classList.contains('show');
            
            if (!isOpen) {
                notificationsDropdown.classList.add('show');
                if (!notificationsLoaded) {
                    loadNotifications();
                }
            } else {
                notificationsDropdown.classList.remove('show');
            }
        });
    }
    
    // Mark all as read
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', markAllNotificationsAsRead);
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.notifications-menu')) {
            notificationsDropdown?.classList.remove('show');
        }
    });
    
    // Load initial notification count
    loadNotificationCount();
}

async function loadNotifications() {
    const loadingEl = document.getElementById('notificationsLoading');
    const listEl = document.getElementById('notificationsList');
    const emptyEl = document.getElementById('notificationsEmpty');
    
    try {
        loadingEl.style.display = 'flex';
        listEl.style.display = 'none';
        emptyEl.style.display = 'none';
        
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/notifications?limit=20`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            displayNotifications(data.data);
            updateNotificationBadge(data.unread_count);
            notificationsLoaded = true;
        } else {
            throw new Error(data.message || 'Failed to load notifications');
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
        listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #e74c3c;">Failed to load notifications</div>';
    } finally {
        loadingEl.style.display = 'none';
        listEl.style.display = 'block';
    }
}

function displayNotifications(notifications) {
    const listEl = document.getElementById('notificationsList');
    const emptyEl = document.getElementById('notificationsEmpty');
    
    if (notifications.length === 0) {
        listEl.style.display = 'none';
        emptyEl.style.display = 'block';
        return;
    }
    
    listEl.innerHTML = '';
    
    notifications.forEach(notification => {
        const notificationEl = createNotificationElement(notification);
        listEl.appendChild(notificationEl);
    });
}

function createNotificationElement(notification) {
    const div = document.createElement('div');
    div.className = `notification-item ${!notification.is_read ? 'unread' : ''}`;
    div.dataset.notificationId = notification.id;
    
    // Determine icon based on type
    let iconContent = '📄';
    let iconClass = 'organization_post';
    
    switch (notification.type) {
        case 'like':
            iconContent = '❤️';
            iconClass = 'like';
            break;
        case 'comment':
            iconContent = '💬';
            iconClass = 'comment';
            break;
        case 'organization_post':
            iconContent = '🏢';
            iconClass = 'organization_post';
            break;
        case 'organization_post':
            iconContent = '🏢';
            iconClass = 'organization_post';
            break;
    }
    
    div.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon ${iconClass}">
                ${iconContent}
            </div>
            <div class="notification-text">
                <div class="notification-title">${escapeHtml(notification.title)}</div>
                <div class="notification-message">${escapeHtml(notification.message)}</div>
                <div class="notification-time">${formatRelativeTime(notification.created_at)}</div>
            </div>
        </div>
    `;
    
    // Add click handler to navigate to post and mark as read
    div.addEventListener('click', () => {
        if (notification.post_id) {
            // Mark as read if unread
            if (!notification.is_read) {
                markNotificationAsRead(notification.id);
            }
            
            // Navigate to posts
            window.location.href = `/post-view.html?id=${notification.post_id}`;
        }
    });
    
    return div;
}

async function loadNotificationCount() {
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/notifications/count`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            updateNotificationBadge(data.unread_count);
        }
    } catch (error) {
        console.error('Error loading notification count:', error);
    }
}

function updateNotificationBadge(count) {
    const badge = document.getElementById('notificationBadge');
    unreadCount = count;
    
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count.toString();
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

async function markNotificationAsRead(notificationId) {
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/notifications/read`, {
            method: 'PATCH',
            body: JSON.stringify({
                notification_ids: [notificationId]
            })
        });
        
        if (response.ok) {
            // Update UI
            const notificationEl = document.querySelector(`[data-notification-id="${notificationId}"]`);
            if (notificationEl) {
                notificationEl.classList.remove('unread');
            }
            
            // Update badge
            if (unreadCount > 0) {
                updateNotificationBadge(unreadCount - 1);
            }
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function markAllNotificationsAsRead() {
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/notifications/read`, {
            method: 'PATCH',
            body: JSON.stringify({
                notification_ids: 'all'
            })
        });
        
        if (response.ok) {
            // Update UI - remove unread class from all notifications
            document.querySelectorAll('.notification-item.unread').forEach(el => {
                el.classList.remove('unread');
            });
            
            // Update badge
            updateNotificationBadge(0);
        }
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

function formatRelativeTime(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diff = now - date;
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== NAVBAR DROPDOWN FUNCTIONALITY ====================
function setupNavbarDropdown() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const logoutBtn = document.getElementById('logoutBtn');
    const userAvatar = document.getElementById('userAvatar');
    const navUserName = document.getElementById('navUserName');
    const navUserUsername = document.getElementById('navUserUsername');

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
            const notificationsDropdown = document.getElementById('notificationsDropdown');
            if (notificationsDropdown) notificationsDropdown.classList.remove('show');
        });
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (userMenuBtn && !userMenuBtn.contains(e.target)) {
            userMenuBtn.classList.remove('active');
            dropdownMenu.classList.remove('show');
        }
    });

    // Logout handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('Swe_Society_token');
            localStorage.removeItem('Swe_Society_user');
            localStorage.removeItem('userId');
            window.location.href = '/auth/login.html';
        });
    }
}

// Initialize navbar dropdown
setupNavbarDropdown();
