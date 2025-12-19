document.addEventListener('DOMContentLoaded', async () => {
    const API_BASE = `${window.location.origin}/api`;
    
    // ==================== NOTICES ELEMENTS ====================
    const noticesList = document.getElementById('noticesList');
    const noticesLoading = document.getElementById('noticesLoading');
    const noticesEmpty = document.getElementById('noticesEmpty');
    const noticesCount = document.getElementById('noticesCount');
    const noticesError = document.getElementById('noticesError');
    const noticesErrorMsg = document.getElementById('noticesErrorMsg');
    const retryNoticesBtn = document.getElementById('retryNoticesBtn');
    
    // ==================== EVENTS ELEMENTS ====================
    const eventsList = document.getElementById('eventsList');
    const eventsLoading = document.getElementById('eventsLoading');
    const eventsEmpty = document.getElementById('eventsEmpty');
    const eventsCount = document.getElementById('eventsCount');
    const eventsError = document.getElementById('eventsError');
    const eventsErrorMsg = document.getElementById('eventsErrorMsg');
    const retryEventsBtn = document.getElementById('retryEventsBtn');
    
    // ==================== DISCUSSIONS ELEMENTS ====================
    const discussionsTab = document.getElementById('discussionsTab');
    const discussionsList = document.getElementById('discussionsList');
    const discussionsLoading = document.getElementById('discussionsLoading');
    const discussionsEmpty = document.getElementById('discussionsEmpty');
    const discussionsCount = document.getElementById('discussionsCount');
    const createDiscussionBtn = document.getElementById('createDiscussionBtn');
    const discussionsError = document.getElementById('discussionsError');
    const discussionsErrorMsg = document.getElementById('discussionsErrorMsg');
    const retryDiscussionsBtn = document.getElementById('retryDiscussionsBtn');
    
    // ==================== APPROVALS ELEMENTS ====================
    const approvalsLoading = document.getElementById('approvalsLoading');
    const approvalsList = document.getElementById('approvalsList');
    const approvalsCount = document.getElementById('approvalsCount');
    const createApprovalBtn = document.getElementById('createApprovalBtn');
    const createApprovalModal = document.getElementById('createApprovalModal');
    const approvalDetailsModal = document.getElementById('approvalDetailsModal');
    
    console.log('Discussions elements loaded:', {
        discussionsTab: discussionsTab,
        discussionsList: discussionsList,
        discussionsLoading: discussionsLoading,
        discussionsEmpty: discussionsEmpty,
        discussionsCount: discussionsCount,
        createDiscussionBtn: createDiscussionBtn
    });
    
    // ==================== CREATE DROPDOWN ELEMENTS ====================
    const createDropdownBtn = document.getElementById('createDropdownBtn');
    const createDropdown = document.getElementById('createDropdown');
    const createMenu = document.getElementById('createMenu');
    const createNoticeOption = document.getElementById('createNoticeOption');
    const createEventOption = document.getElementById('createEventOption');
    const createMeetingRoomOption = document.getElementById('createMeetingRoomOption');

    // ==================== NOTICE MODAL ELEMENTS ====================
    const noticeModal = document.getElementById('createNoticeModal');
    const noticeModalOverlay = document.getElementById('noticeModalOverlay');
    const noticeModalClose = document.getElementById('noticeModalClose');
    const cancelNoticeBtn = document.getElementById('cancelNoticeBtn');
    const noticeForm = document.getElementById('createNoticeForm');
    const noticeTitleInput = document.getElementById('noticeTitle');
    const noticeTagInput = document.getElementById('noticeTag');
    const noticeDescInput = document.getElementById('noticeDescription');
    const noticeAlertEl = document.getElementById('noticeAlert');
    const submitNoticeBtn = document.getElementById('submitNoticeBtn');

    // ==================== EVENT MODAL ELEMENTS ====================
    const eventModal = document.getElementById('createEventModal');
    const eventModalOverlay = document.getElementById('eventModalOverlay');
    const eventModalClose = document.getElementById('eventModalClose');
    const cancelEventBtn = document.getElementById('cancelEventBtn');
    const eventForm = document.getElementById('createEventForm');
    const eventAlertEl = document.getElementById('eventAlert');
    
    // Details Modal elements
    const detailsModal = document.getElementById('eventDetailsModal');
    const detailsOverlay = document.getElementById('detailsOverlay');
    const detailsClose = document.getElementById('detailsClose');
    const detailsContent = document.getElementById('eventDetailsContent');
    const updatesList = document.getElementById('updatesList');
    const addUpdateForm = document.getElementById('addUpdateForm');

    // Notice Details Modal elements
    const noticeDetailsModal = document.getElementById('noticeDetailsModal');
    const noticeDetailsOverlay = document.getElementById('noticeDetailsOverlay');
    const noticeDetailsClose = document.getElementById('noticeDetailsClose');
    const noticeDetailsContent = document.getElementById('noticeDetailsContent');

    let currentEventId = null;

     // ==================== REGISTRATIONS ELEMENTS ====================
     const registrationsList = document.getElementById('registrationsList');
     const registrationsLoading = document.getElementById('registrationsLoading');
     const registrationsCount = document.getElementById('registrationsCount');
     const createRegistrationOption = document.getElementById('createRegistrationOption');
     const createRegistrationModal = document.getElementById('createRegistrationModal');
     const registrationModalClose = document.getElementById('registrationModalClose');
     const cancelRegBtn = document.getElementById('cancelRegBtn');
     const createRegistrationForm = document.getElementById('createRegistrationForm');
     const regTypeSelect = document.getElementById('regType');
     const regFeeGroup = document.getElementById('regFeeGroup');
     const regAlert = document.getElementById('regAlert');

     // Edit Registration Modal elements
     const editRegistrationModal = document.getElementById('editRegistrationModal');
     const editRegistrationModalClose = document.getElementById('editRegistrationModalClose');
     const cancelEditRegBtn = document.getElementById('cancelEditRegBtn');
     const editRegistrationForm = document.getElementById('editRegistrationForm');
     const editRegTypeSelect = document.getElementById('editRegType');
     const editRegFeeGroup = document.getElementById('editRegFeeGroup');
     const editRegAlert = document.getElementById('editRegAlert');

     // ==================== FEES ELEMENTS ====================
     const feesList = document.getElementById('feesList');
     const feesLoading = document.getElementById('feesLoading');
     const feesCount = document.getElementById('feesCount');
     const createFeeOption = document.getElementById('createFeeOption');
     const createFeeModal = document.getElementById('createFeeModal');
     const feeModalClose = document.getElementById('feeModalClose');
     const cancelFeeBtn = document.getElementById('cancelFeeBtn');
     const createFeeForm = document.getElementById('createFeeForm');
     const feeAlert = document.getElementById('feeAlert');

     // Edit Fee Modal elements
     const editFeeModal = document.getElementById('editFeeModal');
     const editFeeModalClose = document.getElementById('editFeeModalClose');
     const cancelEditFeeBtn = document.getElementById('cancelEditFeeBtn');
     const editFeeForm = document.getElementById('editFeeForm');
     const editFeeAlert = document.getElementById('editFeeAlert');

    // ==================== PAYMENT MODAL ELEMENTS ====================
    const paymentModal = document.getElementById('paymentModal');
    const paymentModalClose = document.getElementById('paymentModalClose');
    const cancelPayBtn = document.getElementById('cancelPayBtn');
    const paymentForm = document.getElementById('paymentForm');
    const payAlert = document.getElementById('payAlert');

    // ==================== MANAGE MODAL ELEMENTS ====================
    const manageModal = document.getElementById('manageModal');
    const manageModalClose = document.getElementById('manageModalClose');
    const manageLoading = document.getElementById('manageLoading');
    const manageContent = document.getElementById('manageContent');
    const manageTableHead = document.getElementById('manageTableHead');
    const manageTableBody = document.getElementById('manageTableBody');
    const manageModalTitle = document.getElementById('manageModalTitle');

    // ==================== TAB NAVIGATION ====================
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            
            // Update active tab button
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update active tab content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${tab}-tab`) {
                    content.classList.add('active');
                }
            });
            
            // Load content based on tab
            if (tab === 'discussions') loadDiscussions();
            if (tab === 'registrations') loadRegistrations();
            if (tab === 'fees') loadFees();
            if (tab === 'approvals') {
                approvalsLoading.style.display = 'block';
                approvalsList.innerHTML = '';
                approvalManager.loadApprovals();
            }
        });
    });

    // ==================== MODAL FUNCTIONS ====================
    function openNoticeModal() { noticeModal.style.display = 'flex'; }
    function closeNoticeModal() { 
        noticeModal.style.display = 'none'; 
        noticeForm.reset(); 
        noticeAlertEl.style.display = 'none'; 
    }

    function openEventModal() { eventModal.style.display = 'flex'; }
    function closeEventModal() { 
        eventModal.style.display = 'none'; 
        eventForm.reset(); 
        eventAlertEl.style.display = 'none'; 
    }

    function openDetailsModal() { detailsModal.style.display = 'flex'; }
    function closeDetailsModal() {
        detailsModal.style.display = 'none';
        currentEventId = null;
    }

    function openNoticeDetailsModal() { noticeDetailsModal.style.display = 'flex'; }
    function closeNoticeDetailsModal() {
        noticeDetailsModal.style.display = 'none';
    }

    // Modal event listeners
    if (noticeModalOverlay) noticeModalOverlay.addEventListener('click', closeNoticeModal);
    if (noticeModalClose) noticeModalClose.addEventListener('click', closeNoticeModal);
    if (cancelNoticeBtn) cancelNoticeBtn.addEventListener('click', closeNoticeModal);

    if (eventModalOverlay) eventModalOverlay.addEventListener('click', closeEventModal);
    if (eventModalClose) eventModalClose.addEventListener('click', closeEventModal);
    if (cancelEventBtn) cancelEventBtn.addEventListener('click', closeEventModal);

    if (detailsOverlay) detailsOverlay.addEventListener('click', closeDetailsModal);
    if (detailsClose) detailsClose.addEventListener('click', closeDetailsModal);

    if (noticeDetailsOverlay) noticeDetailsOverlay.addEventListener('click', closeNoticeDetailsModal);
    if (noticeDetailsClose) noticeDetailsClose.addEventListener('click', closeNoticeDetailsModal);

    // ==================== AUTH & ROLE CHECK ====================
    let currentUser = null;
    let currentUserId = null;
    try { 
        await window.authManager.initializeAuth(); 
        currentUser = window.authManager.getUserData();
    } catch (e) {
        console.error('Auth initialization failed:', e);
    }
    
    let isCommittee = false;
    
    if (currentUser?.id || currentUser?.userId) {
        const uid = currentUser.id || currentUser.userId;
        currentUserId = uid;
        try {
            const resp = await fetch(`${API_BASE}/roles/${uid}`);
            const data = await resp.json();
            if (data.success) {
                isCommittee = (data.data || []).some(r => r.role_category === 'committee');
            }
        } catch (err) { console.warn('Role check failed', err); }

        // If name/username missing in token payload, hydrate from profile API
        if (!currentUser?.name || !currentUser?.username) {
            try {
                const profResp = await fetch(`${API_BASE}/profile/${uid}`);
                if (profResp.ok) {
                    const profJson = await profResp.json();
                    if (profJson.success && profJson.data) {
                        currentUser = {
                            ...currentUser,
                            name: profJson.data.name || currentUser?.name,
                            username: profJson.data.username || currentUser?.username
                        };
                        // Persist refreshed user info
                        window.authManager.setAuthData(window.authManager.getToken(), currentUser);
                    }
                }
            } catch (e) {
                console.warn('Profile hydration failed', e);
            }
        }
    }
    
    // Show create dropdown for committee members
    console.log('Committee check - isCommittee:', isCommittee);
    console.log('currentUser:', currentUser);
    
    // Show discussions tab for all logged-in users (for testing)
    if (currentUserId && discussionsTab) {
        console.log('User is logged in, showing discussions tab');
        discussionsTab.style.cssText = 'display: flex !important;';
        console.log('Discussions tab display set to:', window.getComputedStyle(discussionsTab).display);
    }
    
    if (currentUserId && createDiscussionBtn) {
        createDiscussionBtn.style.display = 'inline-flex';
    }
    
    if (isCommittee) {
        console.log('User is a committee member, showing create dropdown');
        if (createDropdownBtn) createDropdownBtn.style.display = 'inline-flex';
    } else {
        console.log('User is NOT a committee member');
        console.log('Available roles:', currentUser);
    }

    // Show update form only for logged-in users
    if (currentUserId) {
        addUpdateForm.style.display = 'block';
        // Pre-load discussions so count updates even before tab click
        try { loadDiscussions(); } catch (e) { console.warn('Preload discussions failed', e); }
    }

    // ==================== CREATE DROPDOWN ====================
    if (createDropdownBtn) {
        createDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            createMenu.classList.toggle('active');
            createDropdown.classList.toggle('show');
        });
    }

    if (createNoticeOption) {
        createNoticeOption.addEventListener('click', () => {
            createDropdown.classList.remove('show');
            createMenu.classList.remove('active');
            openNoticeModal();
        });
    }

    if (createEventOption) {
        createEventOption.addEventListener('click', () => {
            createDropdown.classList.remove('show');
            createMenu.classList.remove('active');
            openEventModal();
        });
    }

    if (createMeetingRoomOption) {
        createMeetingRoomOption.addEventListener('click', () => {
            createDropdown.classList.remove('show');
            createMenu.classList.remove('active');
            openMeetingRoomModal();
        });
    }

    // ==================== UTILITY FUNCTIONS ====================
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatEventType(type) {
        return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    // ==================== LOAD NOTICES ====================
    async function loadNotices(page = 1) {
        noticesLoading.style.display = 'block';
        noticesEmpty.style.display = 'none';
        noticesList.style.display = 'none';
        noticesList.innerHTML = '';
        if (noticesError) noticesError.style.display = 'none';
        
        try {
            const resp = await fetch(`${API_BASE}/society-notices?page=${page}&limit=20`);
                if (!resp.ok) {
                    console.error('Failed to fetch notices:', resp.status);
                    if (noticesError && noticesErrorMsg) {
                        noticesErrorMsg.textContent = `Server returned ${resp.status}.`;
                        noticesError.style.display = 'block';
                    }
                    return;
                }
                const json = await resp.json();
            
                if (!json.success) {
                    console.error('Notices API error:', json.message);
                    if (noticesError && noticesErrorMsg) {
                        noticesErrorMsg.textContent = json.message || 'Unknown error.';
                        noticesError.style.display = 'block';
                    }
                    return;
                }
            
            if (json.success) {
                const items = json.data;
                noticesCount.textContent = items?.length || 0;
                
                if (!items || items.length === 0) {
                    noticesEmpty.style.display = 'block';
                    noticesLoading.style.display = 'none';
                    return;
                }
                
                for (const n of items) {
                    const el = document.createElement('div');
                    el.className = 'notice-card';
                    const when = new Date(n.created_at);
                    const isOwner = currentUserId && n.author?.id === currentUserId;
                    const tagDisplay = n.tag ? n.tag.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Notice';
                    
                    el.innerHTML = `
                        <div class="notice-header">
                            <h3 class="notice-title">${escapeHtml(n.title)}</h3>
                            <span class="notice-tag">${escapeHtml(tagDisplay)}</span>
                        </div>
                        <div class="notice-meta">
                            <span>By ${escapeHtml(n.author?.name || n.author?.username || 'Unknown')}</span>
                            <span class="meta-dot"></span>
                            <span>${when.toLocaleString()}</span>
                        </div>
                        <p class="notice-desc">${escapeHtml(n.short_description || '')}</p>
                        <div class="card-actions">
                            <button class="btn btn-primary btn-sm view-notice-btn" data-id="${n.id}">View Details</button>
                            ${isOwner ? `<button class="btn btn-danger btn-sm delete-notice-btn" data-id="${n.id}">Delete</button>` : ''}
                        </div>
                    `;
                    
                    if (isOwner) {
                        const btn = el.querySelector('.delete-notice-btn');
                        btn.addEventListener('click', async (e) => {
                            e.preventDefault();
                            const id = btn.getAttribute('data-id');
                            if (!confirm('Delete this notice?')) return;
                            
                            try {
                                const resp = await window.authManager.authenticatedFetch(`${API_BASE}/society-notices/${id}`, { method: 'DELETE' });
                                const del = await resp.json();
                                
                                if (resp.ok && del.success) {
                                    el.remove();
                                    const remaining = noticesList.children.length;
                                    noticesCount.textContent = remaining;
                                    if (!remaining) {
                                        noticesList.style.display = 'none';
                                        noticesEmpty.style.display = 'block';
                                    }
                                } else {
                                    alert(del.message || 'Failed to delete notice');
                                }
                            } catch (err) {
                                alert('Network error. Please try again.');
                            }
                        });
                     }

                     // Add view details event listener
                     const viewBtn = el.querySelector('.view-notice-btn');
                     viewBtn.addEventListener('click', () => {
                         loadNoticeDetails(n.id);
                     });

                     noticesList.appendChild(el);
                 }
                 noticesList.style.display = 'flex';
            }
        } catch (e) {
            console.error('Failed to load notices', e);
            if (noticesError && noticesErrorMsg) {
                noticesErrorMsg.textContent = 'Network error. Please try again.';
                noticesError.style.display = 'block';
            }
        } finally {
            noticesLoading.style.display = 'none';
        }
    }

    // ==================== LOAD EVENTS ====================
    async function loadEvents(page = 1) {
        eventsLoading.style.display = 'block';
        eventsEmpty.style.display = 'none';
        eventsList.style.display = 'none';
        eventsList.innerHTML = '';
        if (eventsError) eventsError.style.display = 'none';
        
        try {
            const resp = await fetch(`${API_BASE}/events?page=${page}&limit=20`);
                if (!resp.ok) {
                    console.error('Failed to fetch events:', resp.status);
                    if (eventsError && eventsErrorMsg) {
                        eventsErrorMsg.textContent = `Server returned ${resp.status}.`;
                        eventsError.style.display = 'block';
                    }
                    return;
                }
                const json = await resp.json();
            
                if (!json.success) {
                    console.error('Events API error:', json.message);
                    if (eventsError && eventsErrorMsg) {
                        eventsErrorMsg.textContent = json.message || 'Unknown error.';
                        eventsError.style.display = 'block';
                    }
                    return;
                }
            
            if (json.success) {
                const items = json.data;
                eventsCount.textContent = items?.length || 0;
                
                if (!items || items.length === 0) {
                    eventsEmpty.style.display = 'block';
                    eventsLoading.style.display = 'none';
                    return;
                }
                
                for (const event of items) {
                    const el = document.createElement('div');
                    el.className = 'event-card';
                    
                    const startDate = formatDate(event.start_date);
                    const endDate = event.end_date ? formatDate(event.end_date) : null;
                    const dateDisplay = endDate && endDate !== startDate 
                        ? `${startDate} - ${endDate}` 
                        : startDate;
                    
                    const isCreator = currentUserId && event.creator?.id === currentUserId;
                    
                    el.innerHTML = `
                        <div class="event-header">
                            <div class="event-title-group">
                                <h3 class="event-title">${escapeHtml(event.title)}</h3>
                                <span class="event-creator-meta">👤 ${escapeHtml(event.creator?.name || 'Unknown')}</span>
                            </div>
                            <span class="event-type-badge">${escapeHtml(formatEventType(event.event_type))}</span>
                        </div>
                        <div class="event-date">📅 ${dateDisplay}</div>
                        ${event.description ? `<p class="event-desc">${escapeHtml(event.description.substring(0, 200))}${event.description.length > 200 ? '...' : ''}</p>` : ''}
                        ${event.registration_link ? `<a href="${escapeHtml(event.registration_link)}" target="_blank" class="event-link">📝 Registration Link</a>` : ''}
                        <div class="card-actions">
                            <button class="btn btn-primary btn-sm view-details-btn" data-id="${event.id}">View Details</button>
                            ${(isCreator || isCommittee) ? `<button class="btn btn-danger btn-sm delete-event-btn" data-id="${event.id}">Delete</button>` : ''}
                        </div>
                    `;
                    
                    // Delete button handler
                    if (isCreator || isCommittee) {
                        const deleteBtn = el.querySelector('.delete-event-btn');
                        deleteBtn.addEventListener('click', async (e) => {
                            e.preventDefault();
                            const id = deleteBtn.getAttribute('data-id');
                            if (!confirm('Delete this event?')) return;
                            
                            try {
                                const resp = await window.authManager.authenticatedFetch(`${API_BASE}/events/${id}`, { method: 'DELETE' });
                                const del = await resp.json();
                                
                                if (resp.ok && del.success) {
                                    el.remove();
                                    const remaining = eventsList.children.length;
                                    eventsCount.textContent = remaining;
                                    if (!remaining) {
                                        eventsList.style.display = 'none';
                                        eventsEmpty.style.display = 'block';
                                    }
                                } else {
                                    alert(del.message || 'Failed to delete event');
                                }
                            } catch (err) {
                                alert('Network error. Please try again.');
                            }
                        });
                    }
                    
                    // View details button
                    const viewBtn = el.querySelector('.view-details-btn');
                    viewBtn.addEventListener('click', () => {
                        loadEventDetails(event.id);
                    });
                    
                    eventsList.appendChild(el);
                }
                
                eventsList.style.display = 'grid';
            }
        } catch (error) {
            console.error('Error loading events:', error);
            if (eventsError && eventsErrorMsg) {
                eventsErrorMsg.textContent = 'Network error. Please try again.';
                eventsError.style.display = 'block';
            }
        } finally {
            eventsLoading.style.display = 'none';
        }
    }

    // ==================== LOAD EVENT DETAILS ====================
    async function loadEventDetails(eventId) {
        currentEventId = eventId;

        try {
            const resp = await fetch(`${API_BASE}/events/${eventId}`);
            const json = await resp.json();

            if (json.success) {
                const event = json.data;

                const startDate = formatDate(event.start_date);
                const endDate = event.end_date ? formatDate(event.end_date) : null;
                const dateDisplay = endDate && endDate !== startDate
                    ? `${startDate} - ${endDate}`
                    : startDate;

                detailsContent.innerHTML = `
                    <div class="event-detail-header">
                        <span class="event-type-badge">${escapeHtml(formatEventType(event.event_type))}</span>
                        <h2>${escapeHtml(event.title)}</h2>
                        <div class="event-date">📅 ${dateDisplay}</div>
                    </div>
                    ${event.description ? `<div class="event-description"><p>${escapeHtml(event.description)}</p></div>` : ''}
                    ${event.registration_link ? `<div class="event-reg-link"><a href="${escapeHtml(event.registration_link)}" target="_blank" class="btn btn-primary">📝 Register Here</a></div>` : ''}
                    <div class="event-meta">
                        <p><strong>Created by:</strong> ${escapeHtml(event.creator?.name || 'Unknown')}</p>
                        <p><strong>Posted:</strong> ${new Date(event.created_at).toLocaleString()}</p>
                    </div>
                `;

                // Load updates
                loadEventUpdates(eventId);

                openDetailsModal();
            }
        } catch (error) {
            console.error('Error loading event details:', error);
            alert('Failed to load event details');
        }
    }

    // ==================== LOAD NOTICE DETAILS ====================
    async function loadNoticeDetails(noticeId) {
        try {
            const resp = await fetch(`${API_BASE}/society-notices/${noticeId}`);
            const json = await resp.json();

            if (json.success) {
                const notice = json.data;
                const when = new Date(notice.created_at);
                const tagDisplay = notice.tag ? notice.tag.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Notice';

                noticeDetailsContent.innerHTML = `
                    <div class="event-detail-header">
                        <span class="notice-tag">${escapeHtml(tagDisplay)}</span>
                        <h2>${escapeHtml(notice.title)}</h2>
                        <div class="event-date">📅 ${when.toLocaleString()}</div>
                    </div>
                    ${notice.description ? `<div class="event-description"><p>${escapeHtml(notice.description)}</p></div>` : ''}
                    <div class="event-meta">
                        <p><strong>Posted by:</strong> ${escapeHtml(notice.author?.name || notice.author?.username || 'Unknown')}</p>
                        <p><strong>Posted:</strong> ${when.toLocaleString()}</p>
                    </div>
                `;

                openNoticeDetailsModal();
            }
        } catch (error) {
            console.error('Error loading notice details:', error);
            alert('Failed to load notice details');
        }
    }

    // ==================== LOAD EVENT UPDATES ====================
    async function loadEventUpdates(eventId) {
        try {
            const resp = await fetch(`${API_BASE}/events/${eventId}/updates`);
            const json = await resp.json();
            
            if (json.success) {
                const updates = json.data;
                
                if (updates.length === 0) {
                    updatesList.innerHTML = '<p class="no-updates">No updates yet</p>';
                } else {
                    updatesList.innerHTML = updates.map(update => `
                        <div class="update-item">
                            <div class="update-header">
                                <strong>${escapeHtml(update.user.name)}</strong>
                                <span class="update-time">${new Date(update.created_at).toLocaleString()}</span>
                            </div>
                            <p>${escapeHtml(update.update_text)}</p>
                        </div>
                    `).join('');
                }
            }
        } catch (error) {
            console.error('Error loading updates:', error);
        }
    }

    // ==================== NOTICE FORM SUBMISSION ====================
    function setNoticeSubmitting(isSubmitting) {
        noticeForm.querySelector('.btn-text').style.display = isSubmitting ? 'none' : 'inline';
        noticeForm.querySelector('.spinner').style.display = isSubmitting ? 'inline-block' : 'none';
        submitNoticeBtn.disabled = isSubmitting;
    }

    if (noticeForm) {
        noticeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        noticeAlertEl.style.display = 'none';
        
        const title = noticeTitleInput.value.trim();
        const tag = noticeTagInput.value;
        const description = noticeDescInput.value.trim();
        
        if (!title) {
            noticeAlertEl.textContent = 'Title is required';
            noticeAlertEl.style.display = 'block';
            return;
        }

        setNoticeSubmitting(true);
        try {
            const resp = await window.authManager.authenticatedFetch(`${API_BASE}/society-notices`, {
                method: 'POST',
                body: JSON.stringify({ title, tag, description })
            });
            const data = await resp.json();
            
            if (resp.ok && data.success) {
                closeNoticeModal();
                await loadNotices(1);
                // Switch to notices tab
                document.querySelector('[data-tab="notices"]').click();
            } else {
                noticeAlertEl.textContent = data.message || 'Failed to create notice';
                noticeAlertEl.style.display = 'block';
            }
        } catch (err) {
            noticeAlertEl.textContent = 'Network error. Please try again.';
            noticeAlertEl.style.display = 'block';
        } finally {
            setNoticeSubmitting(false);
        }
        });
    }

    // ==================== EVENT FORM SUBMISSION ====================
    if (eventForm) {
        eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById('submitEventBtn');
        const btnText = submitBtn.querySelector('.btn-text');
        const spinner = submitBtn.querySelector('.spinner');
        
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        spinner.style.display = 'inline-block';
        eventAlertEl.style.display = 'none';
        
        const formData = {
            title: document.getElementById('eventTitle').value.trim(),
            event_type: document.getElementById('eventType').value,
            start_date: document.getElementById('startDate').value,
            end_date: document.getElementById('endDate').value || null,
            description: document.getElementById('eventDescription').value.trim() || null,
            registration_link: document.getElementById('registrationLink').value.trim() || null
        };
        
        try {
            const resp = await window.authManager.authenticatedFetch(`${API_BASE}/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            const json = await resp.json();
            
            if (resp.ok && json.success) {
                closeEventModal();
                loadEvents();
                // Switch to events tab
                document.querySelector('[data-tab="events"]').click();
            } else {
                eventAlertEl.textContent = json.message || 'Failed to create event';
                eventAlertEl.className = 'alert alert-error';
                eventAlertEl.style.display = 'block';
            }
        } catch (error) {
            eventAlertEl.textContent = 'Network error. Please try again.';
            eventAlertEl.className = 'alert alert-error';
            eventAlertEl.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            btnText.style.display = 'inline';
            spinner.style.display = 'none';
        }
        });
    }

    // ==================== ADD UPDATE FORM SUBMISSION ====================
    if (addUpdateForm) {
        addUpdateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const updateText = document.getElementById('updateText').value.trim();
        if (!updateText || !currentEventId) return;
        
        try {
            const resp = await window.authManager.authenticatedFetch(`${API_BASE}/events/${currentEventId}/updates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ update_text: updateText })
            });
            
            const json = await resp.json();
            
            if (resp.ok && json.success) {
                document.getElementById('updateText').value = '';
                loadEventUpdates(currentEventId);
            } else {
                alert(json.message || 'Failed to add update');
            }
        } catch (error) {
            alert('Network error. Please try again.');
        }
        });
    }

    // ==================== NAVBAR DROPDOWN FUNCTIONALITY ====================
    const userMenuBtn = document.getElementById('userMenuBtn');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const logoutBtn = document.getElementById('logoutBtn');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const userUsername = document.getElementById('userUsername');
    const notificationsBtn = document.getElementById('notificationsBtn');
    const notificationsDropdown = document.getElementById('notificationsDropdown');

    function getInitials(name) {
        if (!name) return 'U';
        const names = name.split(' ');
        if (names.length >= 2) {
            return (names[0][0] + names[names.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    async function loadNavUserInfo() {
        if (currentUser) {
            if (userAvatar) userAvatar.textContent = getInitials(currentUser.name);
            if (userName) userName.textContent = currentUser.name || 'User';
            if (userUsername) userUsername.textContent = `@${currentUser.username || 'user'}`;
        } else {
            if (userName) userName.textContent = 'User';
            if (userUsername) userUsername.textContent = '@user';
        }
    }
    
    // Call after currentUser is loaded
    loadNavUserInfo();

    // Toggle user dropdown menu
    if (userMenuBtn) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenuBtn.classList.toggle('active');
            dropdownMenu.classList.toggle('show');
            // Close other dropdowns
            if (notificationsDropdown) notificationsDropdown.classList.remove('show');
            createDropdown.classList.remove('show');
            createMenu.classList.remove('active');
        });
    }
    if (notificationsBtn) {
        // Call after currentUser is loaded
        console.log('Loading nav user info with currentUser:', currentUser);
        loadNavUserInfo();
        notificationsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationsDropdown.classList.toggle('show');
            // Close other dropdowns
            if (userMenuBtn) userMenuBtn.classList.remove('active');
            if (dropdownMenu) dropdownMenu.classList.remove('show');
            createDropdown.classList.remove('show');
            createMenu.classList.remove('active');
        });
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (userMenuBtn && !userMenuBtn.contains(e.target)) {
            userMenuBtn.classList.remove('active');
            dropdownMenu.classList.remove('show');
        }
        if (notificationsBtn && !notificationsBtn.contains(e.target) && !notificationsDropdown.contains(e.target)) {
            notificationsDropdown.classList.remove('show');
        }
        if (createMenu && !createMenu.contains(e.target)) {
            createDropdown.classList.remove('show');
            createMenu.classList.remove('active');
        }
    });

    // Logout handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            window.authManager.logout();
            window.location.href = '/auth/login.html';
        });
    }

    // ==================== MEETING ROOM MODAL ====================
    const meetingRoomModal = document.getElementById('meetingRoomModal');
    const meetingRoomOverlay = document.getElementById('meetingRoomOverlay');
    const meetingRoomClose = document.getElementById('meetingRoomClose');
    const cancelMeetingRoom = document.getElementById('cancelMeetingRoom');
    const meetingRoomForm = document.getElementById('meetingRoomForm');
    const membersList = document.getElementById('membersList');
    const memberSearch = document.getElementById('memberSearch');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const selectSocietyBtn = document.getElementById('selectSocietyBtn');
    const clearSelectionBtn = document.getElementById('clearSelectionBtn');
    const selectedCount = document.getElementById('selectedCount');

    let allMembers = [];
    let societyMembers = [];
    let selectedMemberIds = new Set();

    async function openMeetingRoomModal() {
        if (meetingRoomModal) {
            meetingRoomModal.style.display = 'block';
            await loadBatchOptions();
        }
    }

    function closeMeetingRoomModal() {
        if (meetingRoomModal) meetingRoomModal.style.display = 'none';
        if (meetingRoomForm) meetingRoomForm.reset();
        selectedMemberIds.clear();
        updateSelectedCount();
    }

    if (meetingRoomClose) meetingRoomClose.addEventListener('click', closeMeetingRoomModal);
    if (cancelMeetingRoom) cancelMeetingRoom.addEventListener('click', closeMeetingRoomModal);
    if (meetingRoomOverlay) meetingRoomOverlay.addEventListener('click', closeMeetingRoomModal);

    async function loadBatchOptions() {
        if (!membersList) return;
        
        try {
            membersList.innerHTML = '<div class="loading">Loading members...</div>';
            const response = await window.authManager.authenticatedFetch(`${API_BASE}/groups/batch-options`);
            const data = await response.json();

            if (data.success) {
                allMembers = data.data.all_users;
                societyMembers = data.data.society_members;
                renderMembers(allMembers);
            } else {
                membersList.innerHTML = '<div class="loading">Failed to load members</div>';
            }
        } catch (error) {
            console.error('Error loading batch options:', error);
            membersList.innerHTML = '<div class="loading">Error loading members</div>';
        }
    }

    function renderMembers(members) {
        if (!membersList) return;
        
        membersList.innerHTML = '';
        if (members.length === 0) {
            membersList.innerHTML = '<div class="loading">No members found</div>';
            return;
        }

        members.forEach(member => {
            const item = document.createElement('div');
            item.className = 'member-item';
            item.innerHTML = `
                <input type="checkbox" id="member_${member.id}" value="${member.id}" 
                    ${selectedMemberIds.has(member.id) ? 'checked' : ''}>
                <label for="member_${member.id}" class="member-info">
                    <div class="member-name">${escapeHtml(member.name)}</div>
                    <div class="member-username">@${escapeHtml(member.username)}</div>
                </label>
            `;

            const checkbox = item.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    selectedMemberIds.add(member.id);
                } else {
                    selectedMemberIds.delete(member.id);
                }
                updateSelectedCount();
            });

            membersList.appendChild(item);
        });
    }

    function updateSelectedCount() {
        if (selectedCount) {
            selectedCount.textContent = selectedMemberIds.size;
        }
    }

    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            allMembers.forEach(m => selectedMemberIds.add(m.id));
            renderMembers(allMembers);
            updateSelectedCount();
        });
    }

    if (selectSocietyBtn) {
        selectSocietyBtn.addEventListener('click', () => {
            societyMembers.forEach(m => selectedMemberIds.add(m.id));
            renderMembers(allMembers);
            updateSelectedCount();
        });
    }

    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', () => {
            selectedMemberIds.clear();
            renderMembers(allMembers);
            updateSelectedCount();
        });
    }

    if (memberSearch) {
        memberSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            renderMembers(allMembers);
            return;
        }

            const filtered = allMembers.filter(m => 
                m.name.toLowerCase().includes(query) || 
                m.username.toLowerCase().includes(query)
            );
            renderMembers(filtered);
        });
    }

    if (meetingRoomForm) {
        meetingRoomForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('roomTitle').value.trim();
        const memberIds = Array.from(selectedMemberIds);

        if (!title) {
            alert('Please enter a room title');
            return;
        }

        if (memberIds.length === 0) {
            alert('Please select at least one member');
            return;
        }

        try {
            const response = await window.authManager.authenticatedFetch(`${API_BASE}/groups/meeting-rooms`, {
                method: 'POST',
                body: JSON.stringify({ title, memberIds })
            });

            const data = await response.json();

            if (data.success) {
                alert('Meeting room created successfully!');
                closeMeetingRoomModal();
                // Redirect to messages page with the new group
                window.location.href = `message.html?group=${data.data.group_id}`;
            } else {
                alert(data.message || 'Failed to create meeting room');
            }
        } catch (error) {
            console.error('Error creating meeting room:', error);
            alert('Error creating meeting room');
        }
        });
    }

    // ==================== INITIAL LOAD ====================
    try { await loadNotices(1); } catch {}
    try { await loadEvents(1); } catch {}
    try { await loadRegistrations(); } catch {}
    try { await loadFees(); } catch {}

    // ==================== LOAD DISCUSSIONS ====================
    async function loadDiscussions() {
        console.log('loadDiscussions called');
        console.log('Elements check:', {
            discussionsLoading: !!discussionsLoading,
            discussionsEmpty: !!discussionsEmpty,
            discussionsList: !!discussionsList,
            discussionsCount: !!discussionsCount
        });
        
        if (!discussionsLoading || !discussionsEmpty || !discussionsList || !discussionsCount) {
            console.warn('Discussions elements not found');
            return;
        }
        
        discussionsLoading.style.display = 'block';
        discussionsEmpty.style.display = 'none';
        if (discussionsError) discussionsError.style.display = 'none';
        discussionsList.style.display = 'none';
        discussionsList.innerHTML = '';
        
        try {
            console.log('Fetching discussions from API...');
            const resp = await window.authManager.authenticatedFetch(`${API_BASE}/groups/discussions`);
            
            if (!resp.ok) {
                console.error('Failed to fetch discussions:', resp.status, resp.statusText);
                try {
                    const errorData = await resp.json();
                    console.error('Error response:', errorData);
                    if (discussionsError && discussionsErrorMsg) {
                        discussionsErrorMsg.textContent = errorData.message || `Server error ${resp.status}`;
                        discussionsError.style.display = 'block';
                    }
                } catch {}
                return;
            }
            
            const json = await resp.json();
            console.log('Discussions API response:', json);
            
            if (json.success) {
                const discussions = json.data || [];
                console.log('Number of discussions:', discussions.length);
                discussionsCount.textContent = discussions.length;
                
                if (discussions.length === 0) {
                    discussionsEmpty.style.display = 'block';
                } else {
                    discussions.forEach(discussion => {
                        const el = document.createElement('div');
                        el.className = 'discussion-card';
                        
                        const isDefault = discussion.is_default;
                        const memberCount = discussion.member_count || 0;
                        const lastMessage = discussion.last_message || 'No messages yet';
                        const lastMessageAt = discussion.last_message_at 
                            ? new Date(discussion.last_message_at).toLocaleString() 
                            : '';
                        
                        el.innerHTML = `
                            <div class="discussion-header">
                                <h3 class="discussion-title">
                                    ${escapeHtml(discussion.name)}
                                    ${isDefault ? '<span class="default-badge">Default</span>' : ''}
                                </h3>
                                ${!isDefault ? `<button class="btn-danger btn-sm delete-discussion-btn" data-id="${discussion.id}">Delete</button>` : ''}
                            </div>
                            <div class="discussion-meta">
                                <span>👥 ${memberCount} member${memberCount !== 1 ? 's' : ''}</span>
                                ${lastMessageAt ? `<span>🕒 ${lastMessageAt}</span>` : ''}
                            </div>
                            ${discussion.last_message ? `<p class="discussion-last-message">${escapeHtml(lastMessage.substring(0, 100))}${lastMessage.length > 100 ? '...' : ''}</p>` : ''}
                            <div class="discussion-footer">
                                <button class="btn btn-primary btn-sm open-discussion-btn" data-id="${discussion.id}">
                                    Open Discussion
                                </button>
                            </div>
                        `;
                        
                        // Delete button handler (only for non-default groups)
                        if (!isDefault) {
                            const deleteBtn = el.querySelector('.delete-discussion-btn');
                            deleteBtn.addEventListener('click', async (e) => {
                                e.preventDefault();
                                const id = deleteBtn.getAttribute('data-id');
                                if (!confirm('Delete this discussion? All messages will be lost.')) return;
                                
                                try {
                                    const resp = await window.authManager.authenticatedFetch(`${API_BASE}/groups/${id}`, { method: 'DELETE' });
                                    const del = await resp.json();
                                    
                                    if (resp.ok && del.success) {
                                        el.remove();
                                        const remaining = discussionsList.children.length;
                                        discussionsCount.textContent = remaining;
                                        if (!remaining) {
                                            discussionsList.style.display = 'none';
                                            discussionsEmpty.style.display = 'block';
                                        }
                                    } else {
                                        alert(del.message || 'Failed to delete discussion');
                                    }
                                } catch (err) {
                                    alert('Network error. Please try again.');
                                }
                            });
                        }
                        
                        // Open discussion button
                        const openBtn = el.querySelector('.open-discussion-btn');
                        openBtn.addEventListener('click', () => {
                            const id = openBtn.getAttribute('data-id');
                            window.location.href = `message.html?group=${id}`;
                        });
                        
                        discussionsList.appendChild(el);
                    });
                    
                    discussionsList.style.display = 'grid';
                }
            } else {
                console.error('API response failed:', json.message || 'Unknown error');
                if (discussionsError && discussionsErrorMsg) {
                    discussionsErrorMsg.textContent = json.message || 'Unknown error.';
                    discussionsError.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Error loading discussions:', error);
            if (discussionsError && discussionsErrorMsg) {
                discussionsErrorMsg.textContent = 'Network error. Please try again.';
                discussionsError.style.display = 'block';
            }
        } finally {
            discussionsLoading.style.display = 'none';
        }
    }

    // ==================== REGISTRATIONS & FEES LOGIC ====================

    // --- Modals ---
     function openRegistrationModal() { createRegistrationModal.style.display = 'flex'; }
     function closeRegistrationModal() {
         createRegistrationModal.style.display = 'none';
         createRegistrationForm.reset();
         regFeeGroup.style.display = 'none';
         regAlert.style.display = 'none';
     }

     function openEditRegistrationModal() { editRegistrationModal.style.display = 'flex'; }
     function closeEditRegistrationModal() {
         editRegistrationModal.style.display = 'none';
         editRegistrationForm.reset();
         editRegFeeGroup.style.display = 'none';
         editRegAlert.style.display = 'none';
     }

     function openEditFeeModal() { editFeeModal.style.display = 'flex'; }
     function closeEditFeeModal() {
         editFeeModal.style.display = 'none';
         editFeeForm.reset();
         editFeeAlert.style.display = 'none';
     }

    function openFeeModal() { createFeeModal.style.display = 'flex'; }
    function closeFeeModal() { 
        createFeeModal.style.display = 'none'; 
        createFeeForm.reset(); 
        feeAlert.style.display = 'none';
    }

    function openPaymentModal(type, id, title, amount) {
        document.getElementById('payRelatedType').value = type;
        document.getElementById('payRelatedId').value = id;
        document.getElementById('payTitleDisplay').textContent = title;
        document.getElementById('payAmountDisplay').textContent = `Amount: ${amount} BDT`;
        paymentModal.style.display = 'flex';
    }
    function closePaymentModal() {
        paymentModal.style.display = 'none';
        paymentForm.reset();
        payAlert.style.display = 'none';
    }

    function openManageModal(title) {
        manageModalTitle.textContent = title;
        manageModal.style.display = 'flex';
        manageLoading.style.display = 'block';
        manageContent.style.display = 'none';
    }
    function closeManageModal() {
        manageModal.style.display = 'none';
    }

    if (createRegistrationOption) createRegistrationOption.addEventListener('click', () => {
        createDropdown.classList.remove('show');
        createMenu.classList.remove('active');
        openRegistrationModal();
    });

    if (createFeeOption) createFeeOption.addEventListener('click', () => {
        createDropdown.classList.remove('show');
        createMenu.classList.remove('active');
        openFeeModal();
    });

     if (registrationModalClose) registrationModalClose.addEventListener('click', closeRegistrationModal);
     if (cancelRegBtn) cancelRegBtn.addEventListener('click', closeRegistrationModal);

     if (editRegistrationModalClose) editRegistrationModalClose.addEventListener('click', closeEditRegistrationModal);
     if (cancelEditRegBtn) cancelEditRegBtn.addEventListener('click', closeEditRegistrationModal);

     if (editFeeModalClose) editFeeModalClose.addEventListener('click', closeEditFeeModal);
     if (cancelEditFeeBtn) cancelEditFeeBtn.addEventListener('click', closeEditFeeModal);
    if (feeModalClose) feeModalClose.addEventListener('click', closeFeeModal);
    if (cancelFeeBtn) cancelFeeBtn.addEventListener('click', closeFeeModal);
    if (paymentModalClose) paymentModalClose.addEventListener('click', closePaymentModal);
    if (cancelPayBtn) cancelPayBtn.addEventListener('click', closePaymentModal);
    if (manageModalClose) manageModalClose.addEventListener('click', closeManageModal);

     // Overlay click listeners
     const regOverlay = createRegistrationModal?.querySelector('.modal-overlay');
     if (regOverlay) regOverlay.addEventListener('click', closeRegistrationModal);

     const editRegOverlay = editRegistrationModal?.querySelector('.modal-overlay');
     if (editRegOverlay) editRegOverlay.addEventListener('click', closeEditRegistrationModal);

     const editFeeOverlay = editFeeModal?.querySelector('.modal-overlay');
     if (editFeeOverlay) editFeeOverlay.addEventListener('click', closeEditFeeModal);

    const feeOverlay = createFeeModal?.querySelector('.modal-overlay');
    if (feeOverlay) feeOverlay.addEventListener('click', closeFeeModal);

    const payOverlay = paymentModal?.querySelector('.modal-overlay');
    if (payOverlay) payOverlay.addEventListener('click', closePaymentModal);

    const manageOverlay = manageModal?.querySelector('.modal-overlay');
    if (manageOverlay) manageOverlay.addEventListener('click', closeManageModal);

     // Toggle fee input in registration form
     if (regTypeSelect) {
         regTypeSelect.addEventListener('change', (e) => {
             regFeeGroup.style.display = e.target.value === 'paid' ? 'block' : 'none';
             document.getElementById('regFee').required = e.target.value === 'paid';
         });
     }

     // Toggle fee input in edit registration form
     if (editRegTypeSelect) {
         editRegTypeSelect.addEventListener('change', (e) => {
             editRegFeeGroup.style.display = e.target.value === 'paid' ? 'block' : 'none';
             document.getElementById('editRegFee').required = e.target.value === 'paid';
         });
     }

     // --- Create Registration ---
     if (createRegistrationForm) {
         createRegistrationForm.addEventListener('submit', async (e) => {
             e.preventDefault();
             const btn = document.getElementById('submitRegBtn');
             btn.disabled = true;
             btn.querySelector('.spinner').style.display = 'inline-block';
             btn.querySelector('.btn-text').style.display = 'none';
             regAlert.style.display = 'none';

             const data = {
                 title: document.getElementById('regTitle').value,
                 description: document.getElementById('regDesc').value,
                 deadline: document.getElementById('regDeadline').value,
                 type: document.getElementById('regType').value,
                 fee_amount: document.getElementById('regFee').value
             };

             try {
                 const resp = await window.authManager.authenticatedFetch(`${API_BASE}/registrations`, {
                     method: 'POST',
                     body: JSON.stringify(data)
                 });
                 const json = await resp.json();
                 if (resp.ok && json.success) {
                     closeRegistrationModal();
                     loadRegistrations();
                     document.querySelector('[data-tab="registrations"]').click();
                 } else {
                     regAlert.textContent = json.message || 'Failed to create';
                     regAlert.style.display = 'block';
                 }
             } catch (err) {
                 regAlert.textContent = 'Network error';
                 regAlert.style.display = 'block';
             } finally {
                 btn.disabled = false;
                 btn.querySelector('.spinner').style.display = 'none';
                 btn.querySelector('.btn-text').style.display = 'inline';
             }
         });
     }

     // --- Edit Registration ---
     if (editRegistrationForm) {
         editRegistrationForm.addEventListener('submit', async (e) => {
             e.preventDefault();
             const btn = document.getElementById('submitEditRegBtn');
             btn.disabled = true;
             btn.querySelector('.spinner').style.display = 'inline-block';
             btn.querySelector('.btn-text').style.display = 'none';
             editRegAlert.style.display = 'none';

             const regId = document.getElementById('editRegId').value;
             const data = {
                 title: document.getElementById('editRegTitle').value,
                 description: document.getElementById('editRegDesc').value,
                 deadline: document.getElementById('editRegDeadline').value,
                 type: document.getElementById('editRegType').value,
                 fee_amount: document.getElementById('editRegFee').value
             };

             try {
                 const resp = await window.authManager.authenticatedFetch(`${API_BASE}/registrations/${regId}`, {
                     method: 'PUT',
                     body: JSON.stringify(data)
                 });
                 const json = await resp.json();
                 if (resp.ok && json.success) {
                     closeEditRegistrationModal();
                     loadRegistrations();
                     document.querySelector('[data-tab="registrations"]').click();
                 } else {
                     editRegAlert.textContent = json.message || 'Failed to update';
                     editRegAlert.style.display = 'block';
                 }
             } catch (err) {
                 editRegAlert.textContent = 'Network error';
                 editRegAlert.style.display = 'block';
             } finally {
                 btn.disabled = false;
                 btn.querySelector('.spinner').style.display = 'none';
                 btn.querySelector('.btn-text').style.display = 'inline';
             }
         });
     }

     // --- Edit Fee ---
     if (editFeeForm) {
         editFeeForm.addEventListener('submit', async (e) => {
             e.preventDefault();
             const btn = document.getElementById('submitEditFeeBtn');
             btn.disabled = true;
             btn.querySelector('.spinner').style.display = 'inline-block';
             btn.querySelector('.btn-text').style.display = 'none';
             editFeeAlert.style.display = 'none';

             const feeId = document.getElementById('editFeeId').value;
             const data = {
                 title: document.getElementById('editFeeTitle').value,
                 description: document.getElementById('editFeeDesc').value,
                 deadline: document.getElementById('editFeeDeadline').value,
                 amount: document.getElementById('editFeeAmount').value
             };

             try {
                 const resp = await window.authManager.authenticatedFetch(`${API_BASE}/fees/${feeId}`, {
                     method: 'PUT',
                     body: JSON.stringify(data)
                 });
                 const json = await resp.json();
                 if (resp.ok && json.success) {
                     closeEditFeeModal();
                     loadFees();
                     document.querySelector('[data-tab="fees"]').click();
                 } else {
                     editFeeAlert.textContent = json.message || 'Failed to update';
                     editFeeAlert.style.display = 'block';
                 }
             } catch (err) {
                 editFeeAlert.textContent = 'Network error';
                 editFeeAlert.style.display = 'block';
             } finally {
                 btn.disabled = false;
                 btn.querySelector('.spinner').style.display = 'none';
                 btn.querySelector('.btn-text').style.display = 'inline';
             }
         });
     }

    // --- Create Fee ---
    if (createFeeForm) {
        createFeeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submitFeeBtn');
            btn.disabled = true;
            btn.querySelector('.spinner').style.display = 'inline-block';
            btn.querySelector('.btn-text').style.display = 'none';
            feeAlert.style.display = 'none';

            const data = {
                title: document.getElementById('feeTitle').value,
                description: document.getElementById('feeDesc').value,
                deadline: document.getElementById('feeDeadline').value,
                amount: document.getElementById('feeAmount').value
            };

            try {
                const resp = await window.authManager.authenticatedFetch(`${API_BASE}/fees`, {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
                const json = await resp.json();
                if (resp.ok && json.success) {
                    closeFeeModal();
                    loadFees();
                    document.querySelector('[data-tab="fees"]').click();
                } else {
                    feeAlert.textContent = json.message || 'Failed to create';
                    feeAlert.style.display = 'block';
                }
            } catch (err) {
                feeAlert.textContent = 'Network error';
                feeAlert.style.display = 'block';
            } finally {
                btn.disabled = false;
                btn.querySelector('.spinner').style.display = 'none';
                btn.querySelector('.btn-text').style.display = 'inline';
            }
        });
    }

    // --- Submit Payment ---
    if (paymentForm) {
        paymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submitPayBtn');
            btn.disabled = true;
            btn.querySelector('.spinner').style.display = 'inline-block';
            btn.querySelector('.btn-text').style.display = 'none';
            payAlert.style.display = 'none';

            const data = {
                related_type: document.getElementById('payRelatedType').value,
                related_id: document.getElementById('payRelatedId').value,
                payment_method: document.getElementById('payMethod').value,
                payment_number: document.getElementById('payNumber').value,
                transaction_id: document.getElementById('payTrxId').value,
                message: document.getElementById('payMessage').value
            };

            try {
                const resp = await window.authManager.authenticatedFetch(`${API_BASE}/fees/pay`, {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
                const json = await resp.json();
                if (resp.ok && json.success) {
                    closePaymentModal();
                    if (data.related_type === 'registration') loadRegistrations();
                    else loadFees();
                    alert('Payment submitted for approval!');
                } else {
                    payAlert.textContent = json.message || 'Failed to submit';
                    payAlert.style.display = 'block';
                }
            } catch (err) {
                payAlert.textContent = 'Network error';
                payAlert.style.display = 'block';
            } finally {
                btn.disabled = false;
                btn.querySelector('.spinner').style.display = 'none';
                btn.querySelector('.btn-text').style.display = 'inline';
            }
        });
    }

    // --- Load Registrations ---
    async function loadRegistrations() {
        registrationsLoading.style.display = 'block';
        registrationsList.style.display = 'none';
        registrationsList.innerHTML = '';

        try {
            const resp = await window.authManager.authenticatedFetch(`${API_BASE}/registrations`);
            const json = await resp.json();
            
            if (resp.ok && json.success) {
                const items = json.data;
                registrationsCount.textContent = items?.length || 0;
                if (items.length === 0) {
                    registrationsList.innerHTML = '<div class="empty-state"><p>No registrations available</p></div>';
                } else {
                    items.forEach(item => {
                        const el = document.createElement('div');
                        el.className = 'registration-card';
                        
                        let actionBtn = '';
                        if (item.is_creator) {
                            actionBtn = `<button class="btn btn-secondary btn-sm manage-reg-btn" data-id="${item.id}" data-type="${item.type}" data-title="${escapeHtml(item.title)}">Manage</button>`;
                            if (item.is_open) {
                                actionBtn += ` <button class="btn btn-danger btn-sm close-reg-btn" data-id="${item.id}" style="margin-left:4px">Close</button>`;
                            }
                        } else if (item.user_status === 'registered') {
                            actionBtn = `<span class="badge badge-success">Registered</span>`;
                        } else if (item.user_status === 'pending') {
                            actionBtn = `<span class="badge badge-warning">Pending Approval</span>`;
                        } else if (item.user_status === 'rejected') {
                            actionBtn = `<span class="badge badge-danger">Rejected</span>`;
                        } else {
                            if (!item.is_open) {
                                actionBtn = `<span class="badge badge-secondary" style="background:#9ca3af;color:white">Closed</span>`;
                            } else if (item.type === 'free') {
                                actionBtn = `<button class="btn btn-primary btn-sm register-free-btn" data-id="${item.id}">Register</button>`;
                            } else {
                                actionBtn = `<button class="btn btn-primary btn-sm register-paid-btn" data-id="${item.id}" data-title="${escapeHtml(item.title)}" data-amount="${item.fee_amount}">Pay & Register</button>`;
                            }
                        }

                        el.innerHTML = `
                            <div class="registration-header">
                                <h3 class="registration-title">${escapeHtml(item.title)}</h3>
                                <span class="notice-tag" style="background:${item.type === 'free' ? '#e0f2fe;color:#0369a1' : '#fdf4ff;color:#86198f'}">${item.type.toUpperCase()}</span>
                            </div>
                            <div class="notice-meta">
                                <span>By ${escapeHtml(item.creator_name)}</span>
                                ${item.deadline ? `<span>📅 Deadline: ${new Date(item.deadline).toLocaleDateString()}</span>` : ''}
                                ${item.fee_amount ? `<span>💰 ${item.fee_amount} BDT</span>` : ''}
                                ${!item.is_open ? '<span style="color:#ef4444;font-weight:bold">(Closed)</span>' : ''}
                            </div>
                            <p class="notice-desc">${escapeHtml(item.description || '')}</p>
                            <div class="card-actions">
                                ${actionBtn}
                            </div>
                        `;
                        registrationsList.appendChild(el);
                    });

                    // Bind buttons
                    document.querySelectorAll('.register-free-btn').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            if (!confirm('Confirm registration?')) return;
                            try {
                                const resp = await window.authManager.authenticatedFetch(`${API_BASE}/registrations/${btn.dataset.id}/register`, { method: 'POST' });
                                if (resp.ok) {
                                    alert('Registered successfully!');
                                    loadRegistrations();
                                } else {
                                    const json = await resp.json();
                                    alert(json.message || 'Failed to register');
                                }
                            } catch (e) { alert('Error registering'); }
                        });
                    });

                    document.querySelectorAll('.close-reg-btn').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            if (!confirm('Are you sure you want to close this registration? Users will no longer be able to register.')) return;
                            try {
                                const resp = await window.authManager.authenticatedFetch(`${API_BASE}/registrations/${btn.dataset.id}/close`, { method: 'POST' });
                                if (resp.ok) {
                                    alert('Registration closed successfully!');
                                    loadRegistrations();
                                } else {
                                    alert('Failed to close registration');
                                }
                            } catch (e) { alert('Error closing registration'); }
                        });
                    });

                    document.querySelectorAll('.register-paid-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            openPaymentModal('registration', btn.dataset.id, btn.dataset.title, btn.dataset.amount);
                        });
                    });

                    document.querySelectorAll('.manage-reg-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            manageRegistration(btn.dataset.id, btn.dataset.type, btn.dataset.title);
                        });
                    });
                }
                registrationsList.style.display = 'grid';
            }
        } catch (e) {
            console.error(e);
            registrationsList.innerHTML = '<div class="empty-state"><p>Error loading registrations</p></div>';
            registrationsList.style.display = 'block';
        } finally {
            registrationsLoading.style.display = 'none';
        }
    }

    // --- Load Fees ---
    async function loadFees() {
        feesLoading.style.display = 'block';
        feesList.style.display = 'none';
        feesList.innerHTML = '';

        try {
            const resp = await window.authManager.authenticatedFetch(`${API_BASE}/fees`);
            const json = await resp.json();
            
            if (resp.ok && json.success) {
                const items = json.data;
                feesCount.textContent = items?.length || 0;
                if (items.length === 0) {
                    feesList.innerHTML = '<div class="empty-state"><p>No fees available</p></div>';
                } else {
                    items.forEach(item => {
                        const el = document.createElement('div');
                        el.className = 'fee-card';
                        
                        let actionBtn = '';
                        if (item.is_creator) {
                            actionBtn = `<button class="btn btn-secondary btn-sm manage-fee-btn" data-id="${item.id}" data-title="${escapeHtml(item.title)}">Manage</button>`;
                            if (item.is_open) {
                                actionBtn += ` <button class="btn btn-danger btn-sm close-fee-btn" data-id="${item.id}" style="margin-left:4px">Close</button>`;
                            }
                        } else if (item.user_status === 'approved') {
                            actionBtn = `<span class="badge badge-success">Paid</span>`;
                        } else if (item.user_status === 'pending') {
                            actionBtn = `<span class="badge badge-warning">Pending Approval</span>`;
                        } else if (item.user_status === 'rejected') {
                            actionBtn = `<span class="badge badge-danger">Rejected</span>`;
                        } else {
                            if (!item.is_open) {
                                actionBtn = `<span class="badge badge-secondary" style="background:#9ca3af;color:white">Closed</span>`;
                            } else {
                                actionBtn = `<button class="btn btn-primary btn-sm pay-fee-btn" data-id="${item.id}" data-title="${escapeHtml(item.title)}" data-amount="${item.amount}">Pay Fee</button>`;
                            }
                        }

                        el.innerHTML = `
                            <div class="fee-header">
                                <h3 class="fee-title">${escapeHtml(item.title)}</h3>
                                <span class="fee-status" style="background:#f0fdf4;color:#15803d;border:1.5px solid #22c55e">FEE</span>
                            </div>
                            <div class="fee-meta">
                                <span class="meta-item">👤 By ${escapeHtml(item.creator_name)}</span>
                                ${item.deadline ? `<span class="meta-item">📅 ${new Date(item.deadline).toLocaleDateString()}</span>` : ''}
                                <span class="meta-item">💰 ${item.amount} BDT</span>
                                ${!item.is_open ? '<span class="meta-item" style="color:#ef4444;font-weight:bold">Closed</span>' : ''}
                            </div>
                            <p class="fee-desc">${escapeHtml(item.description || '')}</p>
                            <div class="card-actions">
                                ${actionBtn}
                            </div>
                        `;
                        feesList.appendChild(el);
                    });

                    document.querySelectorAll('.close-fee-btn').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            if (!confirm('Are you sure you want to close this fee collection? Users will no longer be able to pay.')) return;
                            try {
                                const resp = await window.authManager.authenticatedFetch(`${API_BASE}/fees/${btn.dataset.id}/close`, { method: 'POST' });
                                if (resp.ok) {
                                    alert('Fee collection closed successfully!');
                                    loadFees();
                                } else {
                                    alert('Failed to close fee collection');
                                }
                            } catch (e) { alert('Error closing fee collection'); }
                        });
                    });

                    document.querySelectorAll('.pay-fee-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            openPaymentModal('fee_collection', btn.dataset.id, btn.dataset.title, btn.dataset.amount);
                        });
                    });

                    document.querySelectorAll('.manage-fee-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            manageFee(btn.dataset.id, btn.dataset.title);
                        });
                    });
                }
                feesList.style.display = 'grid';
            }
        } catch (e) {
            console.error(e);
            feesList.innerHTML = '<div class="empty-state"><p>Error loading fees</p></div>';
            feesList.style.display = 'block';
        } finally {
            feesLoading.style.display = 'none';
        }
    }

    // --- Manage Logic ---
    // Store current manage context
    let currentManageContext = { type: null, id: null, title: null, relatedType: null };

    async function manageRegistration(id, type, title) {
        openManageModal(`Manage: ${title}`);
        currentManageContext = { type: 'registration', id, title, relatedType: type };
        
        try {
            let endpoint = type === 'free' ? `${API_BASE}/registrations/${id}/participants` : `${API_BASE}/registrations/${id}/payments`;
            const resp = await window.authManager.authenticatedFetch(endpoint);
            const json = await resp.json();

            if (resp.ok && json.success) {
                const data = json.data;
                
                if (type === 'free') {
                    manageTableHead.innerHTML = `<tr><th>Name</th><th>Email</th><th>Registered At</th></tr>`;
                    manageTableBody.innerHTML = data.map(u => `
                        <tr>
                            <td>${escapeHtml(u.name)}</td>
                            <td>${escapeHtml(u.email)}</td>
                            <td>${new Date(u.registered_at).toLocaleString()}</td>
                        </tr>
                    `).join('');
                } else {
                    renderPaymentTable(data);
                }
                manageLoading.style.display = 'none';
                manageContent.style.display = 'block';
                document.getElementById('manageToolbar').style.display = 'flex';
            }
        } catch (e) {
            console.error(e);
            alert('Failed to load data');
            closeManageModal();
        }
    }

    async function manageFee(id, title) {
        openManageModal(`Manage: ${title}`);
        currentManageContext = { type: 'fee', id, title, relatedType: null };
        try {
            const resp = await window.authManager.authenticatedFetch(`${API_BASE}/fees/${id}/payments`);
            const json = await resp.json();
            if (resp.ok && json.success) {
                renderPaymentTable(json.data);
                manageLoading.style.display = 'none';
                manageContent.style.display = 'block';
                document.getElementById('manageToolbar').style.display = 'flex';
            }
        } catch (e) {
            console.error(e);
            alert('Failed to load data');
            closeManageModal();
        }
    }

    function renderPaymentTable(data) {
        manageTableHead.innerHTML = `<tr><th style="width:25%">User</th><th style="width:15%">Method</th><th style="width:20%">Number</th><th style="width:20%">TrxID</th><th style="width:15%">Status</th><th style="width:20%">Action</th></tr>`;
        manageTableBody.innerHTML = data.map(p => `
            <tr>
                <td>
                    <div style="font-weight:500">${escapeHtml(p.user_name)}</div>
                    <small>@${escapeHtml(p.user_username)}</small>
                </td>
                <td><span style="background:rgba(243,113,33,0.1);padding:4px 8px;border-radius:6px;font-size:12px;font-weight:600">${escapeHtml(p.payment_method).toUpperCase()}</span></td>
                <td><code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:12px;color:#333">${escapeHtml(p.payment_number)}</code></td>
                <td><code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:12px;color:#333">${escapeHtml(p.transaction_id)}</code></td>
                <td><span class="badge badge-${p.status === 'approved' ? 'success' : (p.status === 'rejected' ? 'danger' : 'warning')}">${p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span></td>
                <td>
                    ${p.status === 'pending' ? `
                        <button class="btn btn-primary btn-sm approve-btn" data-id="${p.id}">✓ Approve</button>
                        <button class="btn btn-danger btn-sm reject-btn" data-id="${p.id}">✕ Reject</button>
                    ` : '<span style="color:#999">—</span>'}
                </td>
            </tr>
        `).join('');

        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', async () => await updateStatus(btn.dataset.id, 'approved', btn));
        });
        document.querySelectorAll('.reject-btn').forEach(btn => {
            btn.addEventListener('click', async () => await updateStatus(btn.dataset.id, 'rejected', btn));
        });
    }

    async function updateStatus(id, status, btn) {
        if (!confirm(`Mark payment as ${status}?`)) return;
        
        if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.6';
        }
        
        try {
            const resp = await window.authManager.authenticatedFetch(`${API_BASE}/fees/transactions/${id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
            
            if (resp.ok) {
                alert(`Payment ${status} successfully!`);
                closeManageModal();
                // Reload active tab
                const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
                if (activeTab === 'registrations') loadRegistrations();
                if (activeTab === 'fees') loadFees();
            } else {
                alert('Failed to update status');
                if (btn) {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
            }
        } catch (e) { 
            console.error(e);
            alert('Error updating status'); 
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
 }
    }

    // Manage modal action buttons
    const manageToolbar = document.getElementById('manageToolbar');
    const statusBtn = document.getElementById('statusBtn');
    const editBtn = document.getElementById('editBtn');
    const finishBtn = document.getElementById('finishBtn');
    const deleteBtn = document.getElementById('deleteBtn');

    if (statusBtn) {
        statusBtn.addEventListener('click', () => {
            const ctx = currentManageContext;
            let msg = `${ctx.type === 'registration' ? 'Registration' : 'Fee'}: ${ctx.title}\n\n`;
            msg += `ID: ${ctx.id}\n`;
            if (ctx.relatedType) msg += `Type: ${ctx.relatedType}\n`;
            msg += `\nThis displays all registered users and payment details above.`;
            alert(msg);
        });
    }

     if (editBtn) {
         editBtn.addEventListener('click', async () => {
             const ctx = currentManageContext;
             if (!confirm(`Edit ${ctx.type === 'registration' ? 'Registration' : 'Fee'}: ${ctx.title}?`)) return;

             closeManageModal();
             // Fetch current data and show edit form
             try {
                 let endpoint = ctx.type === 'registration'
                     ? `${API_BASE}/registrations/${ctx.id}`
                     : `${API_BASE}/fees/${ctx.id}`;

                 const resp = await window.authManager.authenticatedFetch(endpoint);
                 const json = await resp.json();

                 if (resp.ok && json.success) {
                     const data = json.data;
                     if (ctx.type === 'registration') {
                         // Populate edit registration form
                         document.getElementById('editRegId').value = data.id;
                         document.getElementById('editRegTitle').value = data.title;
                         document.getElementById('editRegDesc').value = data.description || '';
                         document.getElementById('editRegDeadline').value = data.deadline ? new Date(data.deadline).toISOString().slice(0, 16) : '';
                         document.getElementById('editRegType').value = data.type;
                         document.getElementById('editRegFee').value = data.fee_amount || '';

                         // Show/hide fee group based on type
                         editRegFeeGroup.style.display = data.type === 'paid' ? 'block' : 'none';
                         document.getElementById('editRegFee').required = data.type === 'paid';

                         openEditRegistrationModal();
                     } else if (ctx.type === 'fee') {
                         // Populate edit fee form
                         document.getElementById('editFeeId').value = data.id;
                         document.getElementById('editFeeTitle').value = data.title;
                         document.getElementById('editFeeDesc').value = data.description || '';
                         document.getElementById('editFeeDeadline').value = data.deadline ? new Date(data.deadline).toISOString().slice(0, 16) : '';
                         document.getElementById('editFeeAmount').value = data.amount || '';

                         openEditFeeModal();
                     }
                 }
             } catch (e) {
                 console.error(e);
                 alert('Failed to load data');
             }
         });
     }

    if (finishBtn) {
        finishBtn.addEventListener('click', async () => {
            const ctx = currentManageContext;
            if (!confirm(`Mark ${ctx.type === 'registration' ? 'Registration' : 'Fee'} as finished (closed)? Users won't be able to register/pay after this.`)) return;
            
            finishBtn.disabled = true;
            finishBtn.style.opacity = '0.6';
            
            try {
                let endpoint = ctx.type === 'registration' 
                    ? `${API_BASE}/registrations/${ctx.id}/close` 
                    : `${API_BASE}/fees/${ctx.id}/close`;
                
                const resp = await window.authManager.authenticatedFetch(endpoint, { method: 'PUT' });
                
                if (resp.ok) {
                    alert(`${ctx.type === 'registration' ? 'Registration' : 'Fee'} marked as finished!`);
                    closeManageModal();
                    // Reload active tab
                    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
                    if (activeTab === 'registrations') loadRegistrations();
                    if (activeTab === 'fees') loadFees();
                } else {
                    alert('Failed to close registration/fee');
                    finishBtn.disabled = false;
                    finishBtn.style.opacity = '1';
                }
            } catch (e) {
                console.error(e);
                alert('Error closing registration/fee');
                finishBtn.disabled = false;
                finishBtn.style.opacity = '1';
            }
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const ctx = currentManageContext;
            if (!confirm(`Delete ${ctx.type === 'registration' ? 'Registration' : 'Fee'}: ${ctx.title}? This action cannot be undone.`)) return;
            
            deleteBtn.disabled = true;
            deleteBtn.style.opacity = '0.6';
            
            try {
                let endpoint = ctx.type === 'registration' 
                    ? `${API_BASE}/registrations/${ctx.id}` 
                    : `${API_BASE}/fees/${ctx.id}`;
                
                const resp = await window.authManager.authenticatedFetch(endpoint, { method: 'DELETE' });
                
                if (resp.ok) {
                    alert(`${ctx.type === 'registration' ? 'Registration' : 'Fee'} deleted successfully!`);
                    closeManageModal();
                    // Reload active tab
                    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
                    if (activeTab === 'registrations') loadRegistrations();
                    if (activeTab === 'fees') loadFees();
                } else {
                    const json = await resp.json();
                    alert(`Failed to delete: ${json.message || 'Unknown error'}`);
                    deleteBtn.disabled = false;
                    deleteBtn.style.opacity = '1';
                }
            } catch (e) {
                console.error(e);
                alert('Error deleting registration/fee');
                deleteBtn.disabled = false;
                deleteBtn.style.opacity = '1';
            }
        });
    }

    // Create discussion button - redirect to group creation with discussion flag
    if (createDiscussionBtn) {
        createDiscussionBtn.addEventListener('click', () => {
            // Redirect to message.html with createDiscussion flag
            window.location.href = 'message.html?createDiscussion=true';
        });
    }

    // Retry handlers
    if (retryNoticesBtn) retryNoticesBtn.addEventListener('click', () => { loadNotices(1); });
    if (retryEventsBtn) retryEventsBtn.addEventListener('click', () => { loadEvents(1); });
    if (retryDiscussionsBtn) retryDiscussionsBtn.addEventListener('click', () => { loadDiscussions(); });
    
    // ==================== INITIALIZE APPROVAL MANAGER ====================
    approvalManager = new ApprovalManager(API_BASE);
    approvalManager.init().then(() => {
        // Load approvals after initialization
        try { approvalManager.loadApprovals(); } catch (error) {
            console.error('Error loading approvals:', error);
        }
    }).catch(error => {
        console.error('Error initializing approval manager:', error);
    });
    
    // Notice details modal is now handled in loadNotices function
});
