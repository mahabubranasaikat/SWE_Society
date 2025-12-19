(function() {
    const API = `${window.location.origin}/api`;
    
    let currentGroup = null;
    let myId = null;
    let allUsers = [];
    let selectedMembers = new Set();
    
    // DOM Elements
    const groupsList = document.getElementById('groupsList');
    const emptyState = document.getElementById('emptyState');
    const chatArea = document.getElementById('chatArea');
    const chatTitle = document.getElementById('chatTitle');
    const chatSubtitle = document.getElementById('chatSubtitle');
    const chatBody = document.getElementById('chatBody');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const addMembersBtn = document.getElementById('addMembersBtn');
    const createGroupBtn = document.getElementById('createGroupBtn');
    
    // Modals
    const createGroupModal = document.getElementById('createGroupModal');
    const addMembersModal = document.getElementById('addMembersModal');
    const settingsModal = document.getElementById('settingsModal');
    
    async function init() {
        if (!window.authManager.requireAuth()) return;
        const user = window.authManager.getUserData();
        myId = user?.userId || user?.id || null;
        
        initUserMenu(user);
        await loadGroups();
        await loadAllUsers();
        wireEvents();
        
        // Poll for new messages every 10 seconds
        setInterval(() => {
            loadGroups();
            if (currentGroup) {
                refreshMessages();
            }
        }, 10000);
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
    
    async function loadGroups() {
        try {
            const resp = await window.authManager.authenticatedFetch(`${API}/groups`);
            const data = await resp.json();
            if (resp.ok && data.success) {
                renderGroups(data.data);
            }
        } catch (error) {
            console.error('Error loading groups:', error);
        }
    }
    
    function renderGroups(groups) {
        groupsList.innerHTML = '';
        if (!groups || groups.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'group-item';
            empty.style.cursor = 'default';
            empty.innerHTML = '<div style="color:#9ca3af;text-align:center;width:100%;padding:20px;">No groups yet. Create a new group to start!</div>';
            groupsList.appendChild(empty);
            return;
        }
        
        groups.forEach(g => {
            const item = document.createElement('div');
            item.className = 'group-item';
            if (currentGroup && g.id === currentGroup.id) {
                item.classList.add('active');
            }
            
            const lastMsg = g.last_message ? (g.last_message.length > 35 ? g.last_message.substring(0, 35) + '...' : g.last_message) : 'No messages yet';
            
            item.innerHTML = `
                <div class="group-avatar">${initials(g.name)}</div>
                <div class="group-info">
                    <div class="group-name">${g.name}</div>
                    <div class="group-meta">
                        <span>${g.member_count} members</span>
                    </div>
                    <div class="group-last">${lastMsg}</div>
                </div>
            `;
            item.addEventListener('click', () => openGroup(g));
            groupsList.appendChild(item);
        });
    }
    
    async function openGroup(group) {
        currentGroup = group;
        emptyState.style.display = 'none';
        chatArea.style.display = 'flex';
        
        chatTitle.textContent = group.name;
        chatSubtitle.textContent = `${group.member_count} members`;
        
        // Show settings button only for creator
        if (Number(group.creator_id) === Number(myId)) {
            settingsBtn.style.display = 'inline-flex';
        } else {
            settingsBtn.style.display = 'none';
        }
        
        document.querySelectorAll('.group-item').forEach(item => item.classList.remove('active'));
        
        await refreshMessages();
    }
    
    async function refreshMessages() {
        if (!currentGroup) return;
        try {
            const resp = await window.authManager.authenticatedFetch(`${API}/groups/${currentGroup.id}/messages`);
            const data = await resp.json();
            if (resp.ok && data.success) {
                renderMessages(data.data);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }
    
    function renderMessages(messages) {
        chatBody.innerHTML = '';
        if (messages.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <p>No messages yet. Start the conversation!</p>
            `;
            chatBody.appendChild(empty);
            return;
        }
        
        messages.forEach(m => {
            const isMe = Number(m.sender_id) === Number(myId);
            const wrapper = document.createElement('div');
            wrapper.className = 'message-wrapper';
            wrapper.style.alignItems = isMe ? 'flex-end' : 'flex-start';
            
            if (!isMe) {
                const sender = document.createElement('div');
                sender.className = 'message-sender';
                sender.textContent = m.sender_name;
                wrapper.appendChild(sender);
            }
            
            const msg = document.createElement('div');
            msg.className = `msg ${isMe ? 'me' : 'other'}`;
            msg.textContent = m.content;
            wrapper.appendChild(msg);
            
            chatBody.appendChild(wrapper);
        });
        
        chatBody.scrollTop = chatBody.scrollHeight;
    }
    
    async function sendMessage() {
        if (!currentGroup || !messageInput.value.trim()) return;
        
        try {
            const resp = await window.authManager.authenticatedFetch(`${API}/groups/${currentGroup.id}/messages`, {
                method: 'POST',
                body: JSON.stringify({ content: messageInput.value.trim() })
            });
            const data = await resp.json();
            if (resp.ok && data.success) {
                messageInput.value = '';
                await refreshMessages();
                await loadGroups();
            } else {
                alert(data.message || 'Failed to send message');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Error sending message');
        }
    }
    
    async function loadAllUsers() {
        try {
            const resp = await window.authManager.authenticatedFetch(`${API}/groups/users`);
            const data = await resp.json();
            if (resp.ok && data.success) {
                allUsers = data.data.filter(u => Number(u.id) !== Number(myId));
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }
    
    function renderMembersList(users, containerId, searchId = null) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        let filteredUsers = users;
        if (searchId) {
            const searchInput = document.getElementById(searchId);
            const query = searchInput.value.toLowerCase();
            filteredUsers = users.filter(u => 
                u.name.toLowerCase().includes(query) || 
                u.username.toLowerCase().includes(query)
            );
        }
        
        filteredUsers.forEach(u => {
            const item = document.createElement('div');
            item.className = 'member-item';
            
            const isSelected = selectedMembers.has(u.id);
            
            item.innerHTML = `
                <input type="checkbox" class="member-checkbox" ${isSelected ? 'checked' : ''} data-user-id="${u.id}" />
                <div class="member-details">
                    <div class="member-name">${u.name}</div>
                    <div class="member-meta">@${u.username} • ${u.position}</div>
                </div>
            `;
            
            item.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    const checkbox = item.querySelector('.member-checkbox');
                    checkbox.checked = !checkbox.checked;
                    toggleMemberSelection(u.id, checkbox.checked);
                }
            });
            
            const checkbox = item.querySelector('.member-checkbox');
            checkbox.addEventListener('change', (e) => {
                toggleMemberSelection(u.id, e.target.checked);
            });
            
            container.appendChild(item);
        });
    }
    
    function toggleMemberSelection(userId, selected) {
        if (selected) {
            selectedMembers.add(userId);
        } else {
            selectedMembers.delete(userId);
        }
        updateSelectedCount();
    }
    
    function updateSelectedCount() {
        const count = selectedMembers.size;
        document.getElementById('selectedCount').textContent = `${count} member${count !== 1 ? 's' : ''} selected`;
        document.getElementById('roleSelectedCount').textContent = `${count} member${count !== 1 ? 's' : ''} selected`;
        document.getElementById('mixedSelectedCount').textContent = `${count} member${count !== 1 ? 's' : ''} selected`;
        document.getElementById('addSelectedCount').textContent = `${count} member${count !== 1 ? 's' : ''} selected`;
    }
    
    async function loadRoleMembers(role, containerId) {
        try {
            const resp = await window.authManager.authenticatedFetch(`${API}/groups/users/role/${role}`);
            const data = await resp.json();
            if (resp.ok && data.success) {
                return data.data.filter(u => Number(u.id) !== Number(myId));
            }
        } catch (error) {
            console.error('Error loading role members:', error);
        }
        return [];
    }
    
    async function createGroup() {
        const groupName = document.getElementById('groupNameInput').value.trim();
        
        if (!groupName) {
            alert('Please enter a group name');
            return;
        }
        
        if (selectedMembers.size === 0) {
            alert('Please select at least one member');
            return;
        }
        
        try {
            const resp = await window.authManager.authenticatedFetch(`${API}/groups`, {
                method: 'POST',
                body: JSON.stringify({
                    name: groupName,
                    memberIds: Array.from(selectedMembers)
                })
            });
            const data = await resp.json();
            if (resp.ok && data.success) {
                createGroupModal.classList.remove('show');
                document.getElementById('groupNameInput').value = '';
                selectedMembers.clear();
                updateSelectedCount();
                await loadGroups();
                alert('Group created successfully!');
            } else {
                alert(data.message || 'Failed to create group');
            }
        } catch (error) {
            console.error('Error creating group:', error);
            alert('Error creating group');
        }
    }
    
    async function addMembersToGroup() {
        if (!currentGroup || selectedMembers.size === 0) {
            alert('Please select at least one member');
            return;
        }
        
        try {
            const resp = await window.authManager.authenticatedFetch(`${API}/groups/${currentGroup.id}/members`, {
                method: 'POST',
                body: JSON.stringify({
                    memberIds: Array.from(selectedMembers)
                })
            });
            const data = await resp.json();
            if (resp.ok && data.success) {
                addMembersModal.classList.remove('show');
                selectedMembers.clear();
                updateSelectedCount();
                await loadGroups();
                await refreshGroupDetails();
                alert(data.message);
            } else {
                alert(data.message || 'Failed to add members');
            }
        } catch (error) {
            console.error('Error adding members:', error);
            alert('Error adding members');
        }
    }
    
    async function refreshGroupDetails() {
        if (!currentGroup) return;
        try {
            const resp = await window.authManager.authenticatedFetch(`${API}/groups/${currentGroup.id}`);
            const data = await resp.json();
            if (resp.ok && data.success) {
                currentGroup = { ...currentGroup, ...data.data };
                chatSubtitle.textContent = `${data.data.members.length} members`;
            }
        } catch (error) {
            console.error('Error refreshing group details:', error);
        }
    }
    
    async function loadGroupSettings() {
        if (!currentGroup) return;
        
        try {
            const resp = await window.authManager.authenticatedFetch(`${API}/groups/${currentGroup.id}`);
            const data = await resp.json();
            if (resp.ok && data.success) {
                renderSettingsMembers(data.data.members);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
    
    function renderSettingsMembers(members) {
        const container = document.getElementById('settingsMembersList');
        container.innerHTML = '';
        
        members.forEach(m => {
            const item = document.createElement('div');
            item.className = 'member-item';
            item.style.justifyContent = 'space-between';
            
            item.innerHTML = `
                <div style="display: flex; gap: 12px; align-items: center;">
                    <div class="member-details">
                        <div class="member-name">${m.name} ${m.role === 'creator' ? '(Creator)' : ''}</div>
                        <div class="member-meta">@${m.username} • ${m.position}</div>
                    </div>
                </div>
                ${m.role !== 'creator' && Number(m.id) !== Number(myId) ? 
                    `<button class="btn-cancel" style="padding: 6px 12px; font-size: 12px;" data-member-id="${m.id}">Remove</button>` 
                    : ''}
            `;
            
            const removeBtn = item.querySelector('[data-member-id]');
            if (removeBtn) {
                removeBtn.addEventListener('click', async () => {
                    if (confirm(`Remove ${m.name} from the group?`)) {
                        await removeMember(m.id);
                    }
                });
            }
            
            container.appendChild(item);
        });
    }
    
    async function removeMember(memberId) {
        if (!currentGroup) return;
        
        try {
            const resp = await window.authManager.authenticatedFetch(
                `${API}/groups/${currentGroup.id}/members/${memberId}`,
                { method: 'DELETE' }
            );
            const data = await resp.json();
            if (resp.ok && data.success) {
                await loadGroupSettings();
                await loadGroups();
                await refreshGroupDetails();
                alert('Member removed successfully');
            } else {
                alert(data.message || 'Failed to remove member');
            }
        } catch (error) {
            console.error('Error removing member:', error);
            alert('Error removing member');
        }
    }
    
    async function deleteGroup() {
        if (!currentGroup) return;
        
        if (!confirm(`Are you sure you want to delete "${currentGroup.name}"? This action cannot be undone.`)) {
            return;
        }
        
        try {
            const resp = await window.authManager.authenticatedFetch(
                `${API}/groups/${currentGroup.id}`,
                { method: 'DELETE' }
            );
            const data = await resp.json();
            if (resp.ok && data.success) {
                settingsModal.classList.remove('show');
                currentGroup = null;
                emptyState.style.display = 'flex';
                chatArea.style.display = 'none';
                await loadGroups();
                alert('Group deleted successfully');
            } else {
                alert(data.message || 'Failed to delete group');
            }
        } catch (error) {
            console.error('Error deleting group:', error);
            alert('Error deleting group');
        }
    }
    
    function wireEvents() {
        // Send message
        sendBtn.addEventListener('click', sendMessage);
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Create group modal
        createGroupBtn.addEventListener('click', () => {
            createGroupModal.classList.add('show');
            selectedMembers.clear();
            updateSelectedCount();
            renderMembersList(allUsers, 'membersList', 'memberSearch');
        });
        
        document.getElementById('closeCreateModal').addEventListener('click', () => {
            createGroupModal.classList.remove('show');
        });
        
        document.getElementById('cancelCreateBtn').addEventListener('click', () => {
            createGroupModal.classList.remove('show');
        });
        
        document.getElementById('submitCreateBtn').addEventListener('click', createGroup);
        
        // Tab switching
        document.querySelectorAll('.batch-tab').forEach(tab => {
            tab.addEventListener('click', async () => {
                document.querySelectorAll('.batch-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                const tabName = tab.getAttribute('data-tab');
                document.getElementById(`${tabName}Tab`).classList.add('active');
                
                if (tabName === 'specific') {
                    renderMembersList(allUsers, 'membersList', 'memberSearch');
                } else if (tabName === 'role') {
                    setupRoleSelection();
                } else if (tabName === 'mixed') {
                    setupMixedSelection();
                }
            });
        });
        
        // Search
        document.getElementById('memberSearch').addEventListener('input', () => {
            renderMembersList(allUsers, 'membersList', 'memberSearch');
        });
        
        // Add members modal
        addMembersBtn.addEventListener('click', async () => {
            if (!currentGroup) return;
            addMembersModal.classList.add('show');
            selectedMembers.clear();
            updateSelectedCount();
            
            // Load current members to exclude them
            const resp = await window.authManager.authenticatedFetch(`${API}/groups/${currentGroup.id}`);
            const data = await resp.json();
            if (resp.ok && data.success) {
                const currentMemberIds = data.data.members.map(m => m.id);
                const availableUsers = allUsers.filter(u => !currentMemberIds.includes(u.id));
                renderMembersList(availableUsers, 'addMembersList', 'addMemberSearch');
            }
        });
        
        document.getElementById('closeAddModal').addEventListener('click', () => {
            addMembersModal.classList.remove('show');
        });
        
        document.getElementById('cancelAddBtn').addEventListener('click', () => {
            addMembersModal.classList.remove('show');
        });
        
        document.getElementById('submitAddBtn').addEventListener('click', addMembersToGroup);
        
        document.getElementById('addMemberSearch').addEventListener('input', async () => {
            const resp = await window.authManager.authenticatedFetch(`${API}/groups/${currentGroup.id}`);
            const data = await resp.json();
            if (resp.ok && data.success) {
                const currentMemberIds = data.data.members.map(m => m.id);
                const availableUsers = allUsers.filter(u => !currentMemberIds.includes(u.id));
                renderMembersList(availableUsers, 'addMembersList', 'addMemberSearch');
            }
        });
        
        // Settings modal
        settingsBtn.addEventListener('click', async () => {
            settingsModal.classList.add('show');
            await loadGroupSettings();
        });
        
        document.getElementById('closeSettingsModal').addEventListener('click', () => {
            settingsModal.classList.remove('show');
        });
        
        document.getElementById('closeSettingsBtn').addEventListener('click', () => {
            settingsModal.classList.remove('show');
        });
        
        document.getElementById('deleteGroupBtn').addEventListener('click', deleteGroup);
        
        // Close modals on background click
        [createGroupModal, addMembersModal, settingsModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        });
    }
    
    async function setupRoleSelection() {
        const roleCards = document.querySelectorAll('#roleTab .role-card');
        const roleMembersList = document.getElementById('roleMembersList');
        
        let combinedUsers = [];
        
        roleCards.forEach(card => {
            card.addEventListener('click', async () => {
                const checkbox = card.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
                card.classList.toggle('selected', checkbox.checked);
                
                // Load users for selected roles
                combinedUsers = [];
                for (const c of roleCards) {
                    if (c.querySelector('input[type="checkbox"]').checked) {
                        const role = c.getAttribute('data-role');
                        const users = await loadRoleMembers(role, 'roleMembersList');
                        combinedUsers.push(...users);
                    }
                }
                
                // Remove duplicates
                const uniqueUsers = Array.from(new Map(combinedUsers.map(u => [u.id, u])).values());
                renderMembersList(uniqueUsers, 'roleMembersList');
            });
        });
    }
    
    async function setupMixedSelection() {
        const roleCards = document.querySelectorAll('#mixedTab .role-card');
        const mixedMembersList = document.getElementById('mixedMembersList');
        const mixedSearch = document.getElementById('mixedSearch');
        
        let baseUsers = [...allUsers];
        
        async function updateMixedList() {
            let filteredUsers = [...baseUsers];
            
            // Filter by selected roles
            const selectedRoles = [];
            roleCards.forEach(card => {
                if (card.querySelector('input[type="checkbox"]').checked) {
                    selectedRoles.push(card.getAttribute('data-role'));
                }
            });
            
            if (selectedRoles.length > 0) {
                filteredUsers = filteredUsers.filter(u => selectedRoles.includes(u.position));
            }
            
            // Filter by search
            const query = mixedSearch.value.toLowerCase();
            if (query) {
                filteredUsers = filteredUsers.filter(u => 
                    u.name.toLowerCase().includes(query) || 
                    u.username.toLowerCase().includes(query)
                );
            }
            
            renderMembersList(filteredUsers, 'mixedMembersList');
        }
        
        roleCards.forEach(card => {
            card.addEventListener('click', () => {
                const checkbox = card.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
                card.classList.toggle('selected', checkbox.checked);
                updateMixedList();
            });
        });
        
        mixedSearch.addEventListener('input', updateMixedList);
        
        // Initial render
        renderMembersList(baseUsers, 'mixedMembersList');
    }
    
    window.addEventListener('load', init);
})();
