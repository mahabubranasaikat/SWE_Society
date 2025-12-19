const API_BASE_URL = `${window.location.origin}/api`;

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

const userInitials = document.getElementById('userInitials');
const userName = document.getElementById('userName');
const userUsername = document.getElementById('userUsername');
const userMenuBtn = document.getElementById('userMenuBtn');
const dropdownMenu = document.getElementById('dropdownMenu');
const logoutBtn = document.getElementById('logoutBtn');

const createPostBtn = document.getElementById('createPostBtn');
const createPostModal = document.getElementById('createPostModal');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const cancelpostBtn = document.getElementById('cancelPostBtn');
const createPostForm = document.getElementById('createPostForm');
const submitpostBtn = document.getElementById('submitPostBtn');
const postAlert = document.getElementById('postAlert');

const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const postsGrid = document.getElementById('postsGrid');
const loadMoreContainer = document.getElementById('loadMoreContainer');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const searchInput = document.getElementById('searchInput');
const filterTabs = document.querySelectorAll('.filter-tab');
const privacyFilter = document.getElementById('privacyFilter');
const tagFilter = document.getElementById('tagFilter');
const clearFiltersBtn = document.getElementById('clearFilters');

let currentUserId = null;
let currentPage = 1;
let currentFilter = 'all';
let currentPrivacy = '';
let currentTag = '';
let currentSearchQuery = '';
let isSearchMode = false;
let allposts = [];

function getUserId() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlUserId = urlParams.get('userId');
    
    if (urlUserId) return urlUserId;

    const userData = authManager.getUserData();
    if (userData) return userData.userId;

    return localStorage.getItem('userId');
}

function getInitials(name) {
    const names = name.split(' ');
    if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

async function loadUserInfo() {
    currentUserId = getUserId();
    
    if (!currentUserId) {
        window.location.href = '/auth/login.html';
        return;
    }
    
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/profile/${currentUserId}`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            const profile = data.data;

            userInitials.textContent = getInitials(profile.name);
            userName.textContent = profile.name;
            userUsername.textContent = `@${profile.username}`;
            
        } else {
            console.error('Failed to load user info');
            // If profile fetch fails, might be authentication issue
            if (response.status === 401 || response.status === 404) {
                authManager.logout();
                window.location.href = '/auth/login.html';
            }
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

userMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    userMenuBtn.classList.toggle('active');
    dropdownMenu.classList.toggle('show');
});

document.addEventListener('click', (e) => {
    if (!userMenuBtn.contains(e.target)) {
        userMenuBtn.classList.remove('active');
        dropdownMenu.classList.remove('show');
    }
});

logoutBtn.addEventListener('click', () => {
    authManager.logout();
    window.location.href = '/auth/login.html';
});

createPostBtn.addEventListener('click', () => {
    createPostModal.classList.add('show');
    document.body.style.overflow = 'hidden';
});

document.getElementById('postType').addEventListener('change', (e) => {
    const isEvent = e.target.value === 'event';
    const registrationGroup = document.getElementById('registrationLinkGroup');
    const eventEndGroup = document.getElementById('eventEndTimeGroup');
    
    if (isEvent) {
        registrationGroup.style.display = 'block';
        eventEndGroup.style.display = 'block';
    } else {
        registrationGroup.style.display = 'none';
        eventEndGroup.style.display = 'none';
    }
});

function closeModal() {
    createPostModal.classList.remove('show');
    document.body.style.overflow = 'auto';
    createPostForm.reset();
    postAlert.style.display = 'none';
}

modalClose.addEventListener('click', closeModal);
cancelpostBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);

function showpostAlert(message, type) {
    postAlert.textContent = message;
    postAlert.className = `alert ${type}`;
    postAlert.style.display = 'block';
    postAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

createPostForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('postName').value.trim(),
        description: document.getElementById('postDescription').value.trim(),
        link: document.getElementById('postLink').value.trim(),
        tags: document.getElementById('postTags').value.trim(),
        privacy: document.getElementById('postPrivacy').value,
        post_type: document.getElementById('postType').value
    };
    
    // Add event-specific fields if post type is event
    if (formData.post_type === 'event') {
        const registrationLink = document.getElementById('registrationLink').value.trim();
        const eventEndTime = document.getElementById('eventEndTime').value;
        
        if (registrationLink) {
            formData.registration_link = registrationLink;
        }
        if (eventEndTime) {
            formData.event_end_time = eventEndTime;
        }
    }

    submitpostBtn.disabled = true;
    submitpostBtn.querySelector('.btn-text').textContent = 'Creating...';
    submitpostBtn.querySelector('.spinner').style.display = 'inline-block';
    
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/posts`, {
            method: 'POST',
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showpostAlert('Post created successfully!', 'success');
            setTimeout(() => {
                closeModal();
                loadposts(true);
            }, 1500);
        } else {
            showpostAlert(data.message || 'Failed to create post', 'error');
        }
    } catch (error) {
        console.error('Error creating post:', error);
        showpostAlert('Network error. Please try again.', 'error');
    } finally {
        submitpostBtn.disabled = false;
        submitpostBtn.querySelector('.btn-text').textContent = 'Create Post';
        submitpostBtn.querySelector('.spinner').style.display = 'none';
    }
});

async function loadposts(reset = false) {
    if (reset) {
        currentPage = 1;
        allposts = [];
        postsGrid.innerHTML = '';
    }
    
    const postsContainer = document.getElementById('postsContainer');
    loadingState.style.display = 'block';
    postsContainer.style.display = 'none';
    emptyState.style.display = 'none';
    
    try {
        let url = `${API_BASE_URL}/posts?page=${currentPage}&limit=12`;
        
        // Add post type filter
        if (currentFilter && currentFilter !== 'all') {
            url += `&postType=${currentFilter}`;
        }
        
        // Add privacy filter
        if (currentPrivacy) {
            url += `&privacy=${currentPrivacy}`;
        }
        
        if (currentTag) {
            url += `&tag=${encodeURIComponent(currentTag)}`;
        }

        const response = await authManager.authenticatedFetch(url);
        const data = await response.json();
        
        if (response.ok && data.success) {
            allposts = allposts.concat(data.data);
            displayposts(data.data);
            
            if (data.data.length < 12) {
                loadMoreContainer.style.display = 'none';
            } else {
                loadMoreContainer.style.display = 'block';
            }
        } else {
            showEmptyState();
        }
    } catch (error) {
        console.error('Error loading posts:', error);
        showEmptyState();
    } finally {
        loadingState.style.display = 'none';
    }
}

function displayposts(posts) {
    if (allposts.length === 0) {
        showEmptyState();
        return;
    }
    
    const postsContainer = document.getElementById('postsContainer');
    postsContainer.style.display = 'flex';
    
    posts.forEach(post => {
        const card = createpostCard(post);
        
        // Add click handler to navigate to post view
        card.addEventListener('click', (e) => {
            // Don't navigate if clicking on external links
            if (e.target.tagName === 'A' && e.target.hasAttribute('href')) {
                return;
            }
            window.location.href = `/post-view.html?id=${post.id}`;
        });
        
        postsGrid.appendChild(card);
    });
}

function createpostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    
    const privacyClass = post.privacy || 'public';
    const postType = post.post_type || 'post';
    const tags = post.tags ? post.tags.split(',').map(t => t.trim()) : [];
    const description = post.description || 'No description provided';
    const truncatedDesc = description.length > 150 ? description.substring(0, 150) + '...' : description;
    
    const authorInitials = getInitials(post.user_name || 'User');
    const isLiked = post.user_liked > 0;
    const likesCount = post.likes_count || 0;
    const commentsCount = post.total_comments || post.comments_count || 0;

    const postTypeColors = {
        'post': 'blue',
        'achievement': 'gold',
        'announcement': 'purple',
        'blog': 'green',
        'issue': 'red',
        'event': 'orange'
    };
    const postTypeColor = postTypeColors[postType] || 'blue';
    
    card.innerHTML = `
        <div class="post-header">
            <h3>${post.name}</h3>
            <div class="badge-container">
                <span class="post-type-badge ${postTypeColor}">${postType}</span>
                <span class="privacy-badge ${privacyClass}">${privacyClass}</span>
            </div>
        </div>
        
        <div class="post-author">
            <div class="author-avatar">${authorInitials}</div>
            <div class="author-info">
                <a href="/view-profile.html?userId=${post.user_id}" class="author-name-link" onclick="event.stopPropagation()">
                    <span class="author-name">${post.user_name || 'Unknown'}</span>
                </a>
                <a href="/view-profile.html?userId=${post.user_id}" class="author-username-link" onclick="event.stopPropagation()">
                    <span class="author-username">@${post.username || 'user'}</span>
                </a>
            </div>
        </div>
        
        <p class="post-description">${truncatedDesc}</p>
        
        ${postType === 'event' && post.registration_link ? `
            <div class="event-info">
                <a href="${post.registration_link}" class="registration-link" target="_blank" onclick="event.stopPropagation()">
                    🎟️ Register for Event
                </a>
            </div>
        ` : ''}
        
        ${tags.length > 0 ? `
            <div class="post-tags">
                ${tags.slice(0, 5).map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
        ` : ''}
        
        <div class="post-footer">
            <div class="post-stats">
                <button class="stat-btn like-btn ${isLiked ? 'liked' : ''}" data-post-id="${post.id}" data-liked="${isLiked}">
                    <span class="like-icon">${isLiked ? '❤️' : '🤍'}</span>
                    <span class="like-count">${likesCount}</span>
                </button>
                <button class="stat-btn comment-btn" data-post-id="${post.id}">
                    💬 <span class="comment-count">${commentsCount}</span>
                </button>
            </div>
            ${post.link ? `<a href="${post.link}" class="post-link" target="_blank" onclick="event.stopPropagation()">View →</a>` : ''}
        </div>
    `;

    const likeBtn = card.querySelector('.like-btn');
    const commentBtn = card.querySelector('.comment-btn');
    
    likeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglepostLike(post.id, likeBtn);
    });
    
    commentBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Navigate to post view for commenting
        window.location.href = `/post-view.html?id=${post.id}#comments`;
    });
    
    return card;
}

async function togglepostLike(postId, likeBtn) {
    if (!authManager.getToken()) {
        alert('Please log in to like posts');
        return;
    }
    
    try {
        const response = await authManager.authenticatedFetch(`${API_BASE_URL}/posts/${postId}/like`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            const likeIcon = likeBtn.querySelector('.like-icon');
            const likeCount = likeBtn.querySelector('.like-count');
            
            if (data.data.liked) {
                likeBtn.classList.add('liked');
                likeIcon.textContent = '❤️';
                likeBtn.dataset.liked = 'true';
            } else {
                likeBtn.classList.remove('liked');
                likeIcon.textContent = '🤍';
                likeBtn.dataset.liked = 'false';
            }
            
            likeCount.textContent = data.data.likesCount;
        } else {
            alert(data.message || 'Failed to update like');
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        alert('Network error. Please try again.');
    }
}

function showEmptyState() {
    const postsContainer = document.getElementById('postsContainer');
    loadingState.style.display = 'none';
    postsContainer.style.display = 'none';
    emptyState.style.display = 'block';
    loadMoreContainer.style.display = 'none';
}

loadMoreBtn.addEventListener('click', () => {
    currentPage++;
    if (isSearchMode) {
        searchposts();
    } else {
        loadposts();
    }
});

filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter;
        
        // Reset search when changing filters
        if (isSearchMode) {
            searchInput.value = '';
            searchInput.classList.remove('active');
            currentSearchQuery = '';
            isSearchMode = false;
            resetEmptyState();
        }
        
        // Reset and load posts
        loadposts(true);
    });
});

async function loadTags() {
    try {
        const response = await fetch(`${API_BASE_URL}/posts/tags`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            tagFilter.innerHTML = '<option value="">All Tags</option>';
            data.data.forEach(tag => {
                const option = document.createElement('option');
                option.value = tag;
                option.textContent = tag;
                tagFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading tags:', error);
    }
}

// Organization filter removed (not used)

tagFilter.addEventListener('change', (e) => {
    currentTag = e.target.value;
    loadposts(true);
});

privacyFilter.addEventListener('change', (e) => {
    currentPrivacy = e.target.value;
    loadposts(true);
});

clearFiltersBtn.addEventListener('click', () => {
    currentPrivacy = '';
    currentTag = '';
    privacyFilter.value = '';
    tagFilter.value = '';
    
    // Reset search if active
    if (isSearchMode) {
        searchInput.value = '';
        searchInput.classList.remove('active');
        currentSearchQuery = '';
        isSearchMode = false;
        resetEmptyState();
    }
    
    loadposts(true);
});

function performSearch() {
    const searchTerm = searchInput.value.trim();
    if (searchTerm === '') {
        // If search is empty, reload normal posts
        currentSearchQuery = '';
        isSearchMode = false;
        searchInput.classList.remove('active');
        currentPage = 1;
        allposts = [];
        resetEmptyState();
        loadposts(true);
        return;
    }
    
    currentSearchQuery = searchTerm;
    isSearchMode = true;
    searchInput.classList.add('active');
    currentPage = 1;
    allposts = [];
    searchposts(true);
}

async function searchposts(reset = false) {
    if (reset) {
        postsGrid.innerHTML = '';
        allposts = [];
        currentPage = 1;
    }
    
    loadingState.style.display = 'block';
    postsGrid.style.display = 'none';
    emptyState.style.display = 'none';
    
    try {
        let url = `${API_BASE_URL}/posts/search?q=${encodeURIComponent(currentSearchQuery)}&page=${currentPage}&limit=12`;
        
        // Add post type filter to search
        if (currentFilter && currentFilter !== 'all') {
            url += `&postType=${currentFilter}`;
        }
        // Add privacy filter to search so results match selection
        if (currentPrivacy) {
            url += `&privacy=${currentPrivacy}`;
        }
        
        // Use authenticated fetch so privacy (own private/committee) applies
        const response = await authManager.authenticatedFetch(url);
        const data = await response.json();
        
        if (response.ok && data.success) {
            if (reset || currentPage === 1) {
                allposts = data.data;
            } else {
                allposts = allposts.concat(data.data);
            }
            
            if (data.data.length === 0 && currentPage === 1) {
                showSearchEmptyState();
            } else {
                displayposts(reset ? data.data : allposts);
                
                // Show/hide load more button
                if (data.pagination && currentPage < data.pagination.totalPages) {
                    loadMoreContainer.style.display = 'block';
                } else {
                    loadMoreContainer.style.display = 'none';
                }
            }
        } else {
            showSearchEmptyState();
        }
    } catch (error) {
        console.error('Error searching posts:', error);
        showSearchEmptyState();
    } finally {
        loadingState.style.display = 'none';
    }
}

function showSearchEmptyState() {
    loadingState.style.display = 'none';
    postsGrid.style.display = 'none';
    emptyState.style.display = 'block';
    loadMoreContainer.style.display = 'none';
    
    // Update empty state message for search
    const emptyTitle = emptyState.querySelector('.empty-title') || emptyState.querySelector('h3');
    const emptyText = emptyState.querySelector('.empty-text') || emptyState.querySelector('p');
    emptyTitle.textContent = 'No Results Found';
    emptyText.textContent = `No posts found for "${currentSearchQuery}". Try different keywords or browse all posts.`;
}

function resetEmptyState() {
    const emptyTitle = emptyState.querySelector('.empty-title') || emptyState.querySelector('h3');
    const emptyText = emptyState.querySelector('.empty-text') || emptyState.querySelector('p');
    emptyTitle.textContent = 'No posts Yet';
    emptyText.textContent = 'Be the first to create a post!';
}

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        performSearch();
    }
});

// Add search button functionality
const searchBtn = document.querySelector('.search-btn');
if (searchBtn) {
    searchBtn.addEventListener('click', performSearch);
}

// Clear search when input is cleared
searchInput.addEventListener('input', (e) => {
    if (e.target.value.trim() === '' && isSearchMode) {
        searchInput.classList.remove('active');
        performSearch(); // This will reset to normal mode
    }
});

loadUserInfo();
loadposts(true);
loadTags();
initializeNotifications();

// Notification System
let notificationsLoaded = false;
let unreadCount = 0;

function initializeNotifications() {
    const notificationsBtn = document.getElementById('notificationsBtn');
    const notificationsDropdown = document.getElementById('notificationsDropdown');
    const markAllReadBtn = document.getElementById('markAllRead');
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const isOpen = notificationsDropdown.classList.contains('show');

            document.querySelectorAll('.dropdown-menu, .notifications-dropdown').forEach(dropdown => {
                dropdown.classList.remove('show');
            });
            
            if (!isOpen) {
                notificationsDropdown.classList.add('show');
                if (!notificationsLoaded) {
                    loadNotifications();
                }
            }
        });
    }

    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', markAllNotificationsAsRead);
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.notifications-menu')) {
            notificationsDropdown?.classList.remove('show');
        }
    });

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
            
            // Navigate to post
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
