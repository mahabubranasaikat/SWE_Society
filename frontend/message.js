(function() {
    const API = `${window.location.origin}/api`;
    const convoListEl = document.getElementById('convoList');
    const searchInput = document.getElementById('userSearch');
    const searchResultsEl = document.getElementById('searchResults');
    const chatBody = document.getElementById('chatBody');
    const chatTitle = document.getElementById('chatTitle');
    const inputRow = document.getElementById('inputRow');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const globalToggle = document.getElementById('globalToggle');
    const muteBtn = document.getElementById('muteBtn');
    const muteBadge = document.getElementById('muteBadge');
    const muteArea = document.getElementById('muteArea');

    let currentConvo = null;
    let currentConvoMuted = false;
    let myId = null;
    let messagingEnabled = true;
    let currentGroup = null;
    let isGroupChat = false;
    let allUsers = [];
    let isCreatingDiscussion = false; // Flag for discussion creation

    async function init() {
        if (!window.authManager.requireAuth()) return;
        const user = window.authManager.getUserData();
        myId = user?.userId || user?.id || null;
        
        // Check if creating a discussion from society page
        const urlParams = new URLSearchParams(window.location.search);
        isCreatingDiscussion = urlParams.get('createDiscussion') === 'true';
        
        // Initialize user menu
        initUserMenu(user);
        
        await loadSettings();
        await loadAllData();
        updateNavbarBadge();
        wireEvents();
        wireGroupEvents();
        
        // If creating discussion, open the modal automatically
        if (isCreatingDiscussion) {
            const createGroupModal = document.getElementById('createGroupModal');
            const groupModalTitle = document.querySelector('#createGroupModal .modal-header h3');
            if (createGroupModal) {
                createGroupModal.style.display = 'flex';
                if (groupModalTitle) {
                    groupModalTitle.textContent = 'Create Discussion';
                }
            }
        }
    }

    function initUserMenu(user) {
        const userName = document.getElementById('userName');
        const userUsername = document.getElementById('userUsername');
        const userAvatar = document.getElementById('userAvatar');
        const userMenuBtn = document.getElementById('userMenuBtn');
        const dropdownMenu = document.getElementById('dropdownMenu');
        const logoutBtn = document.getElementById('logoutBtn');

        if (userName && user?.name) userName.textContent = user.name;
        if (userUsername && user?.username) userUsername.textContent = `@${user.username}`;
        if (userAvatar && user?.name) userAvatar.textContent = initials(user.name);

        // User menu dropdown
        if (userMenuBtn && dropdownMenu) {
            userMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdownMenu.classList.toggle('show');
            });

            document.addEventListener('click', (e) => {
                if (!e.target.closest('.user-menu')) {
                    dropdownMenu.classList.remove('show');
                }
            });
        }

        // Logout
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                window.authManager.logout();
                window.location.href = '/auth/login.html';
            });
        }
    }

    function initials(name) {
        if (!name) return '?';
        const parts = String(name).trim().split(' ');
        if (parts.length >= 2) return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
        return parts[0].substring(0,2).toUpperCase();
    }

    function renderConversations(dmList, groupList) {
        convoListEl.innerHTML = '';
        const combined = [];
        
        // Add groups with type flag
        if (groupList && groupList.length > 0) {
            groupList.forEach(g => {
                combined.push({
                    ...g,
                    type: 'group',
                    sort_time: new Date(g.last_message_at || g.created_at).getTime()
                });
            });
        }
        
        // Add DMs with type flag
        if (dmList && dmList.length > 0) {
            dmList.forEach(c => {
                combined.push({
                    ...c,
                    type: 'dm',
                    sort_time: new Date(c.last_message_at || c.created_at).getTime()
                });
            });
        }
        
        // Sort by most recent
        combined.sort((a, b) => b.sort_time - a.sort_time);
        
        if (combined.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'convo-item';
            empty.style.cursor = 'default';
            empty.innerHTML = '<div style="color:#9ca3af;text-align:center;width:100%;">No chats yet. Search for users or create a group!</div>';
            convoListEl.appendChild(empty);
            return;
        }
        
        combined.forEach(item => {
            const div = document.createElement('div');
            div.className = 'convo-item';
            
            if (item.type === 'group') {
                // Group item
                if (currentGroup && item.id === currentGroup.id) {
                    div.classList.add('active');
                }
                const last = item.last_message ? (item.last_message.length > 35 ? item.last_message.substring(0, 35) + '...' : item.last_message) : 'No messages yet';
                div.innerHTML = `
                    <div class="avatar" style="background: linear-gradient(135deg, #BE3144 0%, #540863 100%);">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                    </div>
                    <div class="convo-meta">
                        <div class="name">${item.name}</div>
                        <div class="last" style="font-size:12px;">${item.member_count || 0} members · ${last}</div>
                    </div>
                `;
                div.addEventListener('click', () => openGroup(item));
            } else {
                // DM item
                if (currentConvo && item.id === currentConvo.id) {
                    div.classList.add('active');
                }
                const otherName = item.other_name || item.other_username || 'User';
                const last = item.last_message ? (item.last_message.length > 40 ? item.last_message.substring(0, 40) + '...' : item.last_message) : 'No messages yet';
                const unreadBadge = (item.unread_count && item.unread_count > 0) ? `<span class="unread-badge">${item.unread_count}</span>` : '';
                div.innerHTML = `
                    <div class="avatar">${initials(otherName)}</div>
                    <div class="convo-meta">
                        <div class="name">${otherName}</div>
                        <div class="last">${last}</div>
                    </div>
                    ${unreadBadge}
                `;
                div.addEventListener('click', () => openConversation(item));
            }
            
            convoListEl.appendChild(div);
        });
    }

    async function loadAllData() {
        try {
            // Load DMs
            const dmResp = await window.authManager.authenticatedFetch(`${API}/messages`);
            const dmData = await dmResp.json();
            const conversations = dmResp.ok && dmData.success ? dmData.data : [];
            
            // Load groups
            const groupResp = await window.authManager.authenticatedFetch(`${API}/groups`);
            const groupData = await groupResp.json();
            let groups = groupResp.ok && groupData.success ? groupData.data : [];
            
            // Check for group query param
            const urlParams = new URLSearchParams(window.location.search);
            const groupId = urlParams.get('group');
            
            if (groupId) {
                const existingGroup = groups.find(g => Number(g.id) === Number(groupId));
                if (existingGroup) {
                    currentGroup = existingGroup;
                } else {
                    // Try to fetch group details (this will auto-join if allowed)
                    try {
                        const detailsResp = await window.authManager.authenticatedFetch(`${API}/groups/${groupId}`);
                        const detailsData = await detailsResp.json();
                        if (detailsResp.ok && detailsData.success) {
                            const newGroup = detailsData.data;
                            // Add to groups list
                            const groupObj = {
                                id: newGroup.id,
                                name: newGroup.name,
                                creator_id: newGroup.creator_id,
                                created_at: newGroup.created_at,
                                is_creator: newGroup.is_creator,
                                is_default: newGroup.is_default, // Add is_default
                                member_count: newGroup.members ? newGroup.members.length : 0,
                                last_message: null,
                                last_message_at: null
                            };
                            groups.push(groupObj);
                            currentGroup = groupObj;
                        }
                    } catch (err) {
                        console.error('Error fetching requested group:', err);
                    }
                }
            }
            
            renderConversations(conversations, groups);
            
            // If we found/fetched the group, open it
            if (currentGroup) {
                openGroup(currentGroup);
                // Clear query param to avoid reopening on refresh
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            renderConversations([], []);
        }
    }

    async function loadConversations() {
        await loadAllData();
    }

    function renderMessages(msgs, isGroup = false) {
        chatBody.innerHTML = '';
        if (msgs.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-chat';
            empty.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <div>No messages yet. Start the conversation!</div>
            `;
            chatBody.appendChild(empty);
            return;
        }
        msgs.forEach(m => {
            const div = document.createElement('div');
            const isMe = Number(m.sender_id) === Number(myId);
            div.className = `msg ${isMe ? 'me' : 'other'}`;
            
            if (isGroup && !isMe) {
                // Show sender name for group messages
                const senderName = m.sender_name || 'Unknown';
                div.innerHTML = `
                    <div style="font-size:11px;color:#6b7280;margin-bottom:3px;font-weight:600;">${senderName}</div>
                    <div>${m.content}</div>
                `;
            } else {
                div.textContent = m.content;
            }
            
            chatBody.appendChild(div);
        });
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    async function openConversation(c) {
        currentConvo = c;
        currentGroup = null;
        isGroupChat = false;
        chatTitle.textContent = c.other_name || c.other_username || 'Conversation';
        muteArea.style.display = 'block';
        
        // Hide group menu
        const groupMenuArea = document.getElementById('groupMenuArea');
        if (groupMenuArea) groupMenuArea.style.display = 'none';
        
        // Update chat title to show it's clickable for group info
        chatTitle.style.cursor = 'default';
        chatTitle.onclick = null;
        
        // Update active state in conversation list
        document.querySelectorAll('.convo-item').forEach(item => item.classList.remove('active'));
        
        // Mark as read
        try {
            await window.authManager.authenticatedFetch(`${API}/messages/${c.id}/read`, {
                method: 'POST'
            });
            // Reload conversations to update badge
            await loadConversations();
            updateNavbarBadge();
        } catch (err) {
            console.error('Error marking as read:', err);
        }
        
        await refreshMessages();
    }
    
    async function openGroup(g) {
        console.log('=== Opening group ===');
        console.log('Group object:', g);
        console.log('is_creator value:', g.is_creator);
        console.log('is_creator type:', typeof g.is_creator);
        
        currentGroup = g;
        currentConvo = null;
        isGroupChat = true;
        chatTitle.innerHTML = `
            ${g.name}
            <span style="font-size:13px;color:#6b7280;font-weight:400;margin-left:8px;">${g.member_count || 0} members</span>
        `;
        chatTitle.style.cursor = 'pointer';
        chatTitle.onclick = () => showGroupInfo(g.id);
        
        // Hide DM controls, show group menu
        muteArea.style.display = 'none';
        const groupMenuArea = document.getElementById('groupMenuArea');
        if (groupMenuArea) groupMenuArea.style.display = 'flex';
        
        // Update active state
        document.querySelectorAll('.convo-item').forEach(item => item.classList.remove('active'));
        
        await refreshGroupMessages();
        
        // Update group menu items based on role
        updateGroupMenu(g);
    }
    
    async function refreshGroupMessages() {
        if (!currentGroup) return;
        try {
            const resp = await window.authManager.authenticatedFetch(`${API}/groups/${currentGroup.id}/messages`);
            const data = await resp.json();
            if (resp.ok && data.success) {
                renderMessages(data.data, true);
                updateInputState();
            }
        } catch (err) {
            console.error('Error loading group messages:', err);
        }
    }

    async function refreshMessages() {
        if (!currentConvo) return;
        const resp = await window.authManager.authenticatedFetch(`${API}/messages/${currentConvo.id}/messages`);
        const data = await resp.json();
        if (resp.ok && data.success) {
            currentConvoMuted = !!data.meta?.is_muted;
            updateMuteUI();
            renderMessages(data.data);
            updateInputState();
        }
    }

    function updateInputState() {
        // For groups, messaging is always enabled (no muting support yet)
        // For DMs, check messaging_enabled and mute status
        const disabled = isGroupChat ? false : (!messagingEnabled || currentConvoMuted);
        messageInput.disabled = disabled;
        sendBtn.disabled = disabled;
        if (disabled) {
            messageInput.placeholder = !messagingEnabled ? 'Messaging disabled in settings' : 'Conversation is muted';
        } else {
            messageInput.placeholder = 'Type a message...';
        }
    }

    function updateMuteUI() {
        muteBadge.style.display = currentConvoMuted ? 'inline-block' : 'none';
        muteBtn.textContent = currentConvoMuted ? 'Unmute' : 'Mute';
    }

    async function loadSettings() {
        try {
            const resp = await window.authManager.authenticatedFetch(`${API}/messages/settings`);
            const data = await resp.json();
            if (resp.ok && data.success) {
                messagingEnabled = !!data.data.messaging_enabled;
                globalToggle.checked = messagingEnabled;
                updateInputState();
            } else {
                console.error('Failed to load settings:', data.message);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async function setSettings(enabled) {
        try {
            const resp = await window.authManager.authenticatedFetch(`${API}/messages/settings`, {
                method: 'PATCH',
                body: JSON.stringify({ enabled })
            });
            const data = await resp.json();
            if (resp.ok && data.success) {
                messagingEnabled = !!data.data.messaging_enabled;
                updateInputState();
            } else {
                console.error('Failed to update settings:', data.message);
                alert(data.message || 'Failed to update settings');
                globalToggle.checked = messagingEnabled; // Revert
            }
        } catch (error) {
            console.error('Error updating settings:', error);
            alert('Error updating settings');
            globalToggle.checked = messagingEnabled; // Revert
        }
    }

    async function searchUsers(q) {
        const resp = await window.authManager.authenticatedFetch(`${API}/messages/search?q=${encodeURIComponent(q)}`);
        const data = await resp.json();
        if (resp.ok && data.success) {
            renderSearchResults(data.data);
        }
    }

    function renderSearchResults(users) {
        if (!users || users.length === 0) {
            searchResultsEl.style.display = 'none';
            searchResultsEl.innerHTML = '';
            return;
        }
        searchResultsEl.style.display = 'block';
        searchResultsEl.innerHTML = '<div style="padding:8px 16px;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e6e8eb;">SEARCH RESULTS</div>';
        users.forEach(u => {
            const div = document.createElement('div');
            div.className = 'convo-item';
            div.innerHTML = `
                <div class="avatar">${initials(u.name || u.username)}</div>
                <div class="convo-meta">
                    <div class="name">${u.name || ''} <span style="color:#6b7280;font-weight:400;font-size:13px;">@${u.username}</span></div>
                </div>
            `;
            div.addEventListener('click', async () => {
                searchResultsEl.style.display = 'none';
                searchInput.value = '';
                try {
                    const resp = await window.authManager.authenticatedFetch(`${API}/messages/start`, {
                        method: 'POST',
                        body: JSON.stringify({ targetUserId: u.id })
                    });
                    const data = await resp.json();
                    if (resp.ok && data.success) {
                        await loadConversations();
                        // Open the created conversation
                        openConversation({ id: data.data.id, other_id: u.id, other_name: u.name, other_username: u.username });
                    } else {
                        alert(data.message || 'Unable to start conversation');
                    }
                } catch (error) {
                    console.error('Error starting conversation:', error);
                    alert('Failed to start conversation');
                }
            });
            searchResultsEl.appendChild(div);
        });
    }

    async function sendCurrentMessage() {
        const text = messageInput.value.trim();
        if (!text) return;
        
        if (isGroupChat && currentGroup) {
            // Send group message
            const resp = await window.authManager.authenticatedFetch(`${API}/groups/${currentGroup.id}/messages`, {
                method: 'POST',
                body: JSON.stringify({ content: text })
            });
            const data = await resp.json();
            if (resp.ok && data.success) {
                messageInput.value = '';
                await refreshGroupMessages();
                await loadConversations();
            } else {
                alert(data.message || 'Failed to send');
            }
        } else if (currentConvo) {
            // Send DM
            const resp = await window.authManager.authenticatedFetch(`${API}/messages/${currentConvo.id}/messages`, {
                method: 'POST',
                body: JSON.stringify({ content: text })
            });
            const data = await resp.json();
            if (resp.ok && data.success) {
                messageInput.value = '';
                await refreshMessages();
                await loadConversations();
            } else {
                alert(data.message || 'Failed to send');
            }
        }
    }

    function wireEvents() {
        sendBtn.addEventListener('click', sendCurrentMessage);
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendCurrentMessage();
            }
        });

        let searchTimer = null;
        searchInput.addEventListener('input', (e) => {
            const q = e.target.value.trim();
            clearTimeout(searchTimer);
            if (!q) {
                searchResultsEl.style.display = 'none';
                searchResultsEl.innerHTML = '';
                return;
            }
            searchTimer = setTimeout(() => searchUsers(q), 250);
        });

        globalToggle.addEventListener('change', async (e) => {
            await setSettings(e.target.checked);
        });

        muteBtn.addEventListener('click', async () => {
            if (!currentConvo) return;
            const next = !currentConvoMuted;
            const resp = await window.authManager.authenticatedFetch(`${API}/messages/${currentConvo.id}/mute`, {
                method: 'POST',
                body: JSON.stringify({ mute: next })
            });
            const data = await resp.json();
            if (resp.ok && data.success) {
                currentConvoMuted = next;
                updateMuteUI();
                updateInputState();
            }
        });

        // Poll for new messages every 10 seconds
        setInterval(() => {
            loadConversations();
            if (currentConvo) {
                refreshMessages();
            } else if (currentGroup) {
                refreshGroupMessages();
            }
        }, 10000);
    }

    async function updateNavbarBadge() {
        try {
            const resp = await window.authManager.authenticatedFetch(`${API}/messages/unread`);
            const data = await resp.json();
            if (resp.ok && data.success) {
                const count = data.data.unread_count || 0;
                // Update badge if it exists
                let badge = document.querySelector('.messages-badge');
                if (count > 0) {
                    if (!badge) {
                        const messagesLink = document.querySelector('a[href*="message.html"]');
                        if (messagesLink) {
                            badge = document.createElement('span');
                            badge.className = 'messages-badge';
                            messagesLink.style.position = 'relative';
                            messagesLink.appendChild(badge);
                        }
                    }
                    if (badge) badge.textContent = count;
                } else if (badge) {
                    badge.remove();
                }
            }
        } catch (err) {
            console.error('Error updating badge:', err);
        }
    }

    window.addEventListener('load', init);
    
    // GROUP MENU FUNCTIONS
    function updateGroupMenu(group) {
        console.log('=== Update Group Menu ===');
        console.log('Group:', group);
        console.log('is_creator raw value:', group.is_creator);
        console.log('is_creator type:', typeof group.is_creator);
        
        const addMembersItem = document.getElementById('addMembersMenuItem');
        const deleteGroupItem = document.getElementById('deleteGroupMenuItem');
        const leaveGroupItem = document.getElementById('leaveGroupMenuItem');
        
        // Handle both integer (0/1) and boolean values
        const isCreator = group.is_creator === 1 || group.is_creator === true || group.is_creator === '1';
        const isDefault = group.is_default === 1 || group.is_default === true || group.is_default === '1';
        console.log('Computed isCreator:', isCreator);
        console.log('Computed isDefault:', isDefault);
        
        // Both creator and members can add members - always show
        if (addMembersItem) {
            addMembersItem.classList.remove('hidden');
            console.log('✓ Add members item shown');
        } else {
            console.log('✗ Add members item not found');
        }
        
        // Only creator can delete group, BUT NOT if it's a default group
        if (deleteGroupItem) {
            if (isCreator && !isDefault) {
                deleteGroupItem.classList.remove('hidden');
                console.log('✓ Delete group shown (user is creator and not default)');
            } else {
                deleteGroupItem.classList.add('hidden');
                console.log('✗ Delete group hidden');
            }
        } else {
            console.log('✗ Delete group item not found');
        }
        
        // Non-creators can leave. Creators can leave ONLY if it's a default group.
        if (leaveGroupItem) {
            if (!isCreator || isDefault) {
                leaveGroupItem.classList.remove('hidden');
                console.log('✓ Leave group shown');
            } else {
                leaveGroupItem.classList.add('hidden');
                console.log('✗ Leave group hidden (user is creator of non-default group)');
            }
        } else {
            console.log('✗ Leave group item not found');
        }
        
        console.log('=== End Update Group Menu ===');
    }
    
    function wireGroupMenuEvents() {
        const groupMenuBtn = document.getElementById('groupMenuBtn');
        const groupMenu = document.getElementById('groupMenu');
        const groupInfoItem = document.getElementById('groupInfoMenuItem');
        const addMembersItem = document.getElementById('addMembersMenuItem');
        const leaveGroupItem = document.getElementById('leaveGroupMenuItem');
        const deleteGroupItem = document.getElementById('deleteGroupMenuItem');
        
        // Toggle menu
        if (groupMenuBtn) {
            groupMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                groupMenu.classList.toggle('show');
            });
        }
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#groupMenuArea')) {
                if (groupMenu) groupMenu.classList.remove('show');
            }
        });
        
        // Group Info
        if (groupInfoItem) {
            groupInfoItem.addEventListener('click', () => {
                groupMenu.classList.remove('show');
                if (currentGroup) showGroupInfo(currentGroup.id);
            });
        }
        
        // Add Members
        if (addMembersItem) {
            addMembersItem.addEventListener('click', () => {
                groupMenu.classList.remove('show');
                if (currentGroup) showAddMembersModal(currentGroup.id);
            });
        }
        
        // Leave Group
        if (leaveGroupItem) {
            leaveGroupItem.addEventListener('click', async () => {
                groupMenu.classList.remove('show');
                if (!currentGroup) return;
                
                if (confirm(`Are you sure you want to leave ${currentGroup.name}?`)) {
                    await leaveGroup(currentGroup.id);
                }
            });
        }
        
        // Delete Group
        if (deleteGroupItem) {
            deleteGroupItem.addEventListener('click', async () => {
                groupMenu.classList.remove('show');
                if (!currentGroup) return;
                
                if (confirm(`Are you sure you want to delete ${currentGroup.name}? This cannot be undone.`)) {
                    await deleteGroup(currentGroup.id);
                }
            });
        }
    }
    
    async function leaveGroup(groupId) {
        try {
            const resp = await window.authManager.authenticatedFetch(`${API}/groups/${groupId}/leave`, {
                method: 'POST'
            });
            const data = await resp.json();
            
            if (resp.ok && data.success) {
                // Clear current chat
                currentGroup = null;
                isGroupChat = false;
                chatBody.innerHTML = '';
                chatTitle.textContent = 'Select a conversation';
                const groupMenuArea = document.getElementById('groupMenuArea');
                if (groupMenuArea) groupMenuArea.style.display = 'none';
                
                // Reload conversations
                await loadConversations();
                
                alert('You have left the group');
            } else {
                alert(data.message || 'Failed to leave group');
            }
        } catch (err) {
            console.error('Error leaving group:', err);
            alert('Failed to leave group');
        }
    }
    
    // Initialize group menu events
    wireGroupMenuEvents();
    
    // GROUP FUNCTIONALITY
    let selectedUserIds = new Set(); // Persistent selection across tabs
    
    function wireGroupEvents() {
        const createGroupBtn = document.getElementById('createGroupBtn');
        const createGroupModal = document.getElementById('createGroupModal');
        const closeGroupModal = document.getElementById('closeGroupModal');
        const cancelGroupBtn = document.getElementById('cancelGroupBtn');
        const submitGroupBtn = document.getElementById('submitGroupBtn');
        const groupNameInput = document.getElementById('groupNameInput');
        
        // Modal controls
        if (createGroupBtn) {
            createGroupBtn.addEventListener('click', () => {
                createGroupModal.style.display = 'flex';
                groupNameInput.value = '';
                selectedUserIds.clear(); // Clear previous selections
                loadAllUsers();
                switchTab('specific');
            });
        }
        
        const closeModal = () => {
            createGroupModal.style.display = 'none';
            selectedUserIds.clear();
            clearRoleSelections();
        };
        
        if (closeGroupModal) closeGroupModal.addEventListener('click', closeModal);
        if (cancelGroupBtn) cancelGroupBtn.addEventListener('click', closeModal);
        
        // Tab switching
        document.querySelectorAll('.batch-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                switchTab(tabName);
            });
        });
        
        // Create group
        if (submitGroupBtn) {
            submitGroupBtn.addEventListener('click', async () => {
                console.log('Create group button clicked');
                
                const name = groupNameInput.value.trim();
                console.log('Group name:', name);
                
                if (!name) {
                    alert('Please enter a group name');
                    return;
                }
                
                const memberIds = Array.from(selectedUserIds);
                console.log('Selected user IDs:', memberIds);
                console.log('Selected user IDs count:', memberIds.length);
                
                if (memberIds.length === 0) {
                    alert('Please select at least one member');
                    return;
                }
                
                const requestBody = { 
                    name, 
                    memberIds,
                    isDiscussion: isCreatingDiscussion // Include discussion flag
                };
                console.log('Request body:', JSON.stringify(requestBody, null, 2));
                
                try {
                    console.log('Sending request to:', `${API}/groups`);
                    const resp = await window.authManager.authenticatedFetch(`${API}/groups`, {
                        method: 'POST',
                        body: JSON.stringify(requestBody)
                    });
                    
                    console.log('Response status:', resp.status);
                    console.log('Response ok:', resp.ok);
                    
                    const data = await resp.json();
                    console.log('Response data:', data);
                    
                    if (resp.ok && data.success) {
                        console.log('Group created successfully');
                        closeModal();
                        
                        // If it was a discussion, redirect to society page
                        if (isCreatingDiscussion) {
                            alert('Discussion created successfully!');
                            window.location.href = 'society.html';
                            return;
                        }
                        
                        await loadConversations();
                        // Open the newly created group with proper structure
                        const newGroup = {
                            id: data.data.id,
                            name: data.data.name,
                            member_count: memberIds.length + 1, // members + creator
                            created_at: new Date().toISOString(),
                            is_creator: true // User who created it is the creator
                        };
                        console.log('Opening group:', newGroup);
                        openGroup(newGroup);
                    } else {
                        console.error('Group creation failed:', data);
                        alert('Failed to create group: ' + (data.message || 'Unknown error'));
                    }
                } catch (err) {
                    console.error('Error creating group:', err);
                    alert('Failed to create group: ' + err.message);
                }
            });
        }
        
        // Member search
        const memberSearch = document.getElementById('memberSearch');
        if (memberSearch) {
            memberSearch.addEventListener('input', (e) => {
                filterMembers('specific', e.target.value);
            });
        }
        
        // Role selection
        document.querySelectorAll('.role-card').forEach(card => {
            card.addEventListener('click', async function() {
                const role = this.dataset.role;
                const checkbox = this.querySelector('input[type="checkbox"]');
                const wasChecked = checkbox.checked;
                checkbox.checked = !checkbox.checked;
                
                if (checkbox.checked) {
                    this.style.borderColor = '#540863';
                    this.style.background = '#f3e8ff';
                } else {
                    this.style.borderColor = '#e5e7eb';
                    this.style.background = 'white';
                    
                    // Remove users of this role from selectedUserIds when unchecking
                    if (wasChecked) {
                        try {
                            const resp = await window.authManager.authenticatedFetch(`${API}/groups/users/role/${role}`);
                            const data = await resp.json();
                            if (resp.ok && data.success) {
                                data.data.forEach(u => selectedUserIds.delete(u.id));
                            }
                        } catch (err) {
                            console.error('Error removing role users:', err);
                        }
                    }
                }
                
                await loadUsersByRole();
            });
        });
    }
    
    function switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.batch-tab').forEach(t => {
            if (t.dataset.tab === tabName) {
                t.classList.add('active');
                t.style.borderBottomColor = '#540863';
                t.style.color = '#540863';
            } else {
                t.classList.remove('active');
                t.style.borderBottomColor = 'transparent';
                t.style.color = '#6b7280';
            }
        });
        
        // Show/hide tab content
        document.querySelectorAll('.tab-content').forEach(c => {
            c.style.display = 'none';
        });
        
        if (tabName === 'specific') {
            document.getElementById('specificTab').style.display = 'block';
            renderMembersList(allUsers, 'membersList', 'selectedCount');
        } else if (tabName === 'role') {
            document.getElementById('roleTab').style.display = 'block';
            loadUsersByRole();
        }
    }
    
    async function loadAllUsers() {
        try {
            const resp = await window.authManager.authenticatedFetch(`${API}/groups/users`);
            const data = await resp.json();
            if (resp.ok && data.success) {
                allUsers = data.data;
                renderMembersList(allUsers, 'membersList', 'selectedCount');
            }
        } catch (err) {
            console.error('Error loading users:', err);
        }
    }
    
    async function loadUsersByRole() {
        const selectedRoles = [];
        document.querySelectorAll('.role-card input[type="checkbox"]:checked').forEach(cb => {
            selectedRoles.push(cb.parentElement.dataset.role);
        });
        
        if (selectedRoles.length === 0) {
            document.getElementById('roleMembersList').innerHTML = '<div style="padding:16px;text-align:center;color:#9ca3af;">Select roles above</div>';
            updateTotalCount();
            return;
        }
        
        try {
            const users = [];
            for (const role of selectedRoles) {
                const resp = await window.authManager.authenticatedFetch(`${API}/groups/users/role/${role}`);
                const data = await resp.json();
                if (resp.ok && data.success) {
                    users.push(...data.data);
                }
            }
            
            // Remove duplicates
            const uniqueUsers = users.filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i);
            
            // Add all currently displayed role users to selectedUserIds
            uniqueUsers.forEach(u => selectedUserIds.add(u.id));
            
            // Render with autoSelect true so they appear checked
            renderMembersList(uniqueUsers, 'roleMembersList', 'roleSelectedCount', true);
        } catch (err) {
            console.error('Error loading role users:', err);
        }
    }
    
    
    function renderMembersList(users, listId, countId, autoSelect = false) {
        const listEl = document.getElementById(listId);
        const countEl = document.getElementById(countId);
        
        if (!users || users.length === 0) {
            listEl.innerHTML = '<div style="padding:16px;text-align:center;color:#9ca3af;">No members found</div>';
            updateTotalCount();
            return;
        }
        
        listEl.innerHTML = '';
        users.forEach(u => {
            const div = document.createElement('div');
            div.style.cssText = 'display:flex;align-items:center;padding:12px;border-bottom:1px solid #f3f4f6;cursor:pointer;';
            div.dataset.userId = u.id;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.style.marginRight = '12px';
            
            // Check if already selected in persistent storage
            if (autoSelect || selectedUserIds.has(u.id)) {
                checkbox.checked = true;
            }
            
            const avatar = document.createElement('div');
            avatar.style.cssText = 'width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#BE3144,#540863);color:white;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14px;margin-right:12px;';
            avatar.textContent = initials(u.name || u.username);
            
            const info = document.createElement('div');
            info.style.flex = '1';
            info.innerHTML = `
                <div style="font-weight:600;font-size:14px;color:#1f2937;">${u.name || ''}</div>
                <div style="font-size:12px;color:#6b7280;">@${u.username}</div>
            `;
            
            div.appendChild(checkbox);
            div.appendChild(avatar);
            div.appendChild(info);
            
            div.addEventListener('click', (e) => {
                // Prevent double-toggle if clicking checkbox directly
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                }
                
                // Update persistent selection
                if (checkbox.checked) {
                    selectedUserIds.add(u.id);
                    console.log('Added user', u.id, 'to selection. Total:', selectedUserIds.size);
                } else {
                    selectedUserIds.delete(u.id);
                    console.log('Removed user', u.id, 'from selection. Total:', selectedUserIds.size);
                }
                
                updateTotalCount();
            });
            
            // Also handle direct checkbox clicks
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    selectedUserIds.add(u.id);
                    console.log('Checkbox checked - Added user', u.id, '. Total:', selectedUserIds.size);
                } else {
                    selectedUserIds.delete(u.id);
                    console.log('Checkbox unchecked - Removed user', u.id, '. Total:', selectedUserIds.size);
                }
                updateTotalCount();
            });
            
            listEl.appendChild(div);
        });
        
        updateTotalCount();
    }
    
    function updateTotalCount() {
        // Update count displays for both tabs
        const specificCount = document.getElementById('selectedCount');
        const roleCount = document.getElementById('roleSelectedCount');
        
        const total = selectedUserIds.size;
        const text = `${total} member${total !== 1 ? 's' : ''} selected`;
        
        if (specificCount) specificCount.textContent = text;
        if (roleCount) roleCount.textContent = text;
    }
    
    function filterMembers(tab, query) {
        const q = query.toLowerCase();
        const filtered = allUsers.filter(u => 
            (u.name && u.name.toLowerCase().includes(q)) ||
            (u.username && u.username.toLowerCase().includes(q))
        );
        
        renderMembersList(filtered, 'membersList', 'selectedCount');
    }
    
    function clearRoleSelections() {
        document.querySelectorAll('.role-card').forEach(card => {
            const checkbox = card.querySelector('input[type="checkbox"]');
            checkbox.checked = false;
            card.style.borderColor = '#e5e7eb';
            card.style.background = 'white';
        });
    }
    
    async function showGroupInfo(groupId) {
        try {
            const resp = await window.authManager.authenticatedFetch(`${API}/groups/${groupId}`);
            const data = await resp.json();
            if (resp.ok && data.success) {
                const group = data.data;
                const modal = document.getElementById('groupInfoModal');
                const title = document.getElementById('groupInfoTitle');
                const membersList = document.getElementById('groupMembersList');
                const adminActions = document.getElementById('groupAdminActions');
                
                title.textContent = group.name;
                
                // Render members
                membersList.innerHTML = '<h4 style="font-size:14px;font-weight:700;margin-bottom:12px;color:#374151;">Members</h4>';
                group.members.forEach(m => {
                    const div = document.createElement('div');
                    div.style.cssText = 'display:flex;align-items:center;padding:10px;border-bottom:1px solid #f3f4f6;';
                    
                    const avatar = document.createElement('div');
                    avatar.style.cssText = 'width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#BE3144,#540863);color:white;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14px;margin-right:12px;';
                    avatar.textContent = initials(m.name || m.username);
                    
                    const info = document.createElement('div');
                    info.style.flex = '1';
                    const role = m.role === 'creator' ? '<span style="font-size:11px;color:#540863;font-weight:600;margin-left:6px;">ADMIN</span>' : '';
                    info.innerHTML = `
                        <div style="font-weight:600;font-size:14px;">${m.name || ''} ${role}</div>
                        <div style="font-size:12px;color:#6b7280;">@${m.username}</div>
                    `;
                    
                    div.appendChild(avatar);
                    div.appendChild(info);
                    
                    // Remove button (only for admin and not self)
                    if (group.is_creator && m.id !== myId) {
                        const removeBtn = document.createElement('button');
                        removeBtn.textContent = 'Remove';
                        removeBtn.style.cssText = 'padding:4px 12px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;';
                        removeBtn.onclick = async () => {
                            if (confirm(`Remove ${m.name} from group?`)) {
                                await removeMember(groupId, m.id);
                            }
                        };
                        div.appendChild(removeBtn);
                    }
                    
                    membersList.appendChild(div);
                });
                
                // Show admin actions if creator
                if (group.is_creator) {
                    adminActions.style.display = 'block';
                    const addBtn = document.getElementById('addMembersBtn');
                    const deleteBtn = document.getElementById('deleteGroupBtn');
                    
                    addBtn.onclick = () => {
                        modal.style.display = 'none';
                        showAddMembersModal(groupId);
                    };
                    
                    deleteBtn.onclick = async () => {
                        if (confirm('Are you sure you want to delete this group? This cannot be undone.')) {
                            await deleteGroup(groupId);
                        }
                    };
                } else {
                    adminActions.style.display = 'none';
                }
                
                modal.style.display = 'flex';
                
                const closeBtn = document.getElementById('closeInfoModal');
                closeBtn.onclick = () => modal.style.display = 'none';
            }
        } catch (err) {
            console.error('Error loading group info:', err);
        }
    }
    
    async function showAddMembersModal(groupId) {
        const modal = document.getElementById('addMembersModal');
        const search = document.getElementById('addMemberSearch');
        const listEl = document.getElementById('addMembersList');
        
        // Load available users
        try {
            const resp = await window.authManager.authenticatedFetch(`${API}/groups/users`);
            const data = await resp.json();
            if (resp.ok && data.success) {
                const users = data.data;
                
                // Filter function
                const renderFiltered = (query = '') => {
                    const q = query.toLowerCase();
                    const filtered = users.filter(u =>
                        (u.name && u.name.toLowerCase().includes(q)) ||
                        (u.username && u.username.toLowerCase().includes(q))
                    );
                    
                    listEl.innerHTML = '';
                    filtered.forEach(u => {
                        const div = document.createElement('div');
                        div.style.cssText = 'display:flex;align-items:center;padding:12px;border-bottom:1px solid #f3f4f6;cursor:pointer;';
                        div.dataset.userId = u.id;
                        
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.style.marginRight = '12px';
                        
                        const avatar = document.createElement('div');
                        avatar.style.cssText = 'width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#BE3144,#540863);color:white;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14px;margin-right:12px;';
                        avatar.textContent = initials(u.name || u.username);
                        
                        const info = document.createElement('div');
                        info.style.flex = '1';
                        info.innerHTML = `
                            <div style="font-weight:600;font-size:14px;">${u.name || ''}</div>
                            <div style="font-size:12px;color:#6b7280;">@${u.username}</div>
                        `;
                        
                        div.appendChild(checkbox);
                        div.appendChild(avatar);
                        div.appendChild(info);
                        
                        div.onclick = () => {
                            checkbox.checked = !checkbox.checked;
                            const count = listEl.querySelectorAll('input:checked').length;
                            document.getElementById('addSelectedCount').textContent = `${count} member${count !== 1 ? 's' : ''} selected`;
                        };
                        
                        listEl.appendChild(div);
                    });
                };
                
                search.value = '';
                search.oninput = (e) => renderFiltered(e.target.value);
                renderFiltered();
                
                modal.style.display = 'flex';
                
                const closeBtn = document.getElementById('closeAddModal');
                const cancelBtn = document.getElementById('cancelAddBtn');
                const submitBtn = document.getElementById('submitAddBtn');
                
                closeBtn.onclick = cancelBtn.onclick = () => modal.style.display = 'none';
                
                submitBtn.onclick = async () => {
                    const memberIds = [];
                    listEl.querySelectorAll('input:checked').forEach(cb => {
                        memberIds.push(Number(cb.parentElement.dataset.userId));
                    });
                    
                    if (memberIds.length === 0) {
                        alert('Please select at least one member');
                        return;
                    }
                    
                    try {
                        const resp = await window.authManager.authenticatedFetch(`${API}/groups/${groupId}/members`, {
                            method: 'POST',
                            body: JSON.stringify({ memberIds })
                        });
                        const data = await resp.json();
                        if (resp.ok && data.success) {
                            modal.style.display = 'none';
                            showGroupInfo(groupId);
                        } else {
                            alert(data.message || 'Failed to add members');
                        }
                    } catch (err) {
                        console.error('Error adding members:', err);
                        alert('Failed to add members');
                    }
                };
            }
        } catch (err) {
            console.error('Error loading users:', err);
        }
    }
    
    async function removeMember(groupId, userId) {
        try {
            const resp = await window.authManager.authenticatedFetch(`${API}/groups/${groupId}/members/${userId}`, {
                method: 'DELETE'
            });
            const data = await resp.json();
            if (resp.ok && data.success) {
                showGroupInfo(groupId);
            } else {
                alert(data.message || 'Failed to remove member');
            }
        } catch (err) {
            console.error('Error removing member:', err);
            alert('Failed to remove member');
        }
    }
    
    async function deleteGroup(groupId) {
        try {
            const resp = await window.authManager.authenticatedFetch(`${API}/groups/${groupId}`, {
                method: 'DELETE'
            });
            const data = await resp.json();
            if (resp.ok && data.success) {
                document.getElementById('groupInfoModal').style.display = 'none';
                currentGroup = null;
                isGroupChat = false;
                chatBody.innerHTML = '';
                chatTitle.textContent = '';
                await loadConversations();
            } else {
                alert(data.message || 'Failed to delete group');
            }
        } catch (err) {
            console.error('Error deleting group:', err);
            alert('Failed to delete group');
        }
    }
})();
