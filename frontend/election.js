// ==================== CONSTANTS ====================
const API_BASE = `${window.location.origin}/api`;
let currentUser = null;
let currentTab = 'ongoing';
let elections = [];
let defaultPosts = [];
let selectedPosts = [];

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🗳️ Election page loaded');
    
    // Check authentication - use both token keys
    const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
    if (!token) {
        console.error('No token found, redirecting to login');
        window.location.href = '/auth/login.html';
        return;
    }
    
    console.log('Token found, loading user data...');
    
    // Get current user info
    await getCurrentUser();
    
    // Load default posts
    await loadDefaultPosts();
    
    // Load elections
    await loadElections();
    
    // Setup event listeners
    setupEventListeners();
});

// ==================== USER MANAGEMENT ====================
async function getCurrentUser() {
    try {
        console.log('Loading current user...');
        
        // First try to get user from localStorage (auth-manager stores it there)
        const userDataStr = localStorage.getItem('Swe_Society_user');
        if (userDataStr) {
            try {
                currentUser = JSON.parse(userDataStr);
                console.log('✅ User loaded from cache:', currentUser.name);
            } catch (e) {
                console.error('Failed to parse cached user data:', e);
            }
        }
        
        // Verify token with server and get fresh user data
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        if (!token) {
            console.error('❌ No token found');
            throw new Error('No authentication token');
        }
        
        const response = await fetch(`${API_BASE}/verify`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            console.error('❌ Failed to verify token:', response.status, response.statusText);
            throw new Error('Failed to verify authentication');
        }
        
        const data = await response.json();
        if (!data.data) {
            throw new Error('Invalid user data in response');
        }
        
        // Normalize shape so downstream code can rely on `id`
        currentUser = { ...data.data, id: data.data.userId };
        console.log('✅ User verified and loaded:', currentUser.name);
        
        // Update user info in navbar (new dropdown style)
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        const userUsername = document.getElementById('userUsername');
        
        if (userAvatar) userAvatar.textContent = getInitials(currentUser.name);
        if (userName) userName.textContent = currentUser.name || 'User';
        if (userUsername) userUsername.textContent = `@${currentUser.username || 'user'}`;
        
        // Check if panel member and set button state
        const isPanelMember = checkPanelMember(currentUser);
        console.log('Is panel member:', isPanelMember);
        const createBtn = document.getElementById('createElectionBtn');
        if (createBtn) {
            if (isPanelMember) {
                createBtn.disabled = false;
                createBtn.title = 'Create a new election';
                createBtn.style.opacity = '1';
                createBtn.style.cursor = 'pointer';
            } else {
                createBtn.disabled = true;
                createBtn.title = 'Only panel members can create elections';
                createBtn.style.opacity = '0.5';
                createBtn.style.cursor = 'not-allowed';
            }
        }
        
        // Hide admin panel button - management is now per-election
        const adminBtn = document.getElementById('adminPanelBtn');
        if (adminBtn) {
            adminBtn.style.display = 'none';
        }
        
        // Setup navbar dropdown functionality
        setupNavbarDropdown();
    } catch (err) {
        console.error('❌ Error getting user:', err);
        showAlert('Failed to load user information. Please login again.', 'danger');
        setTimeout(() => {
            window.location.href = '/auth/login.html';
        }, 2000);
    }
}

// Get initials from name
function getInitials(name) {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// Setup navbar dropdown functionality
function setupNavbarDropdown() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const logoutBtn = document.getElementById('logoutBtn');
    const notificationsBtn = document.getElementById('notificationsBtn');
    const notificationsDropdown = document.getElementById('notificationsDropdown');

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
            localStorage.removeItem('token');
            localStorage.removeItem('Swe_Society_token');
            localStorage.removeItem('Swe_Society_user');
            localStorage.removeItem('userId');
            window.location.href = '/auth/login.html';
        });
    }
}

function checkPanelMember(user) {
    if (!user.roles || !Array.isArray(user.roles) || user.roles.length === 0) {
        return false;
    }
    // Allow various committee roles for panel access (matching backend logic)
    return user.roles.some(role =>
        role.toLowerCase().includes('panel') ||
        role.toLowerCase().includes('president') ||
        role.toLowerCase().includes('vice president') ||
        role.toLowerCase().includes('general secretary') ||
        role.toLowerCase().includes('secretary') ||
        role === 'Election Panel Member'
    );
}

// ==================== DEFAULT POSTS ====================
async function loadDefaultPosts() {
    try {
        console.log('Loading default posts...');
        const response = await fetch(`${API_BASE}/elections/posts/default`);
        if (!response.ok) {
            console.error('Failed to load posts:', response.status);
            throw new Error('Failed to load posts');
        }
        
        const data = await response.json();
        defaultPosts = data.data || [];
        console.log('✅ Loaded', defaultPosts.length, 'default posts');
    } catch (err) {
        console.error('Error loading default posts:', err);
        showAlert('Failed to load posts: ' + err.message, 'danger');
    }
}

// ==================== ELECTIONS ====================
async function loadElections() {
    try {
        console.log('Loading elections...');
        document.getElementById('electionsLoading').style.display = 'block';
        document.getElementById('electionsList').style.display = 'none';
        document.getElementById('electionsEmpty').style.display = 'none';
        
        const response = await fetch(`${API_BASE}/elections`);
        if (!response.ok) {
            console.error('Failed to load elections:', response.status);
            throw new Error('Failed to load elections');
        }
        
        const data = await response.json();
        elections = data.data || [];
        
        console.log('✅ Loaded', elections.length, 'elections');
        
        // Check voting status, candidate status, and vote request status for each election
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        if (token && currentUser) {
            for (let election of elections) {
                try {
                    // Check if user has voted
                    const voteCheck = await fetch(`${API_BASE}/elections/${election.id}/votes/check`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (voteCheck.ok) {
                        const voteData = await voteCheck.json();
                        election.userHasVoted = voteData.hasVoted;
                    }
                    
                    // Check candidate status for current user
                    const candidateCheck = await fetch(`${API_BASE}/elections/${election.id}/candidates/check`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (candidateCheck.ok) {
                        const candData = await candidateCheck.json();
                        election.userCandidateStatus = candData.data ? candData.data.status : null;
                    }
                    
                    // Check vote request status for current user
                    const voteReqCheck = await fetch(`${API_BASE}/elections/${election.id}/vote-requests`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (voteReqCheck.ok) {
                        const voteReqData = await voteReqCheck.json();
                        let allRequests = [];
                        if (Array.isArray(voteReqData.data)) {
                            allRequests = voteReqData.data;
                        } else if (voteReqData.data && typeof voteReqData.data === 'object') {
                            Object.values(voteReqData.data).forEach(arr => {
                                if (Array.isArray(arr)) allRequests = allRequests.concat(arr);
                            });
                        }
                        const userVoteReq = allRequests.find(r => r.user_id === currentUser.id);
                        election.userVoteRequestStatus = userVoteReq ? userVoteReq.status : null;
                    }
                } catch (err) {
                    console.log('Could not check status for election', election.id);
                }
            }
        }
        
        displayElections();
    } catch (err) {
        console.error('Error loading elections:', err);
        showAlert('Failed to load elections: ' + err.message, 'danger');
    } finally {
        document.getElementById('electionsLoading').style.display = 'none';
    }
}

function displayElections() {
    const listEl = document.getElementById('electionsList');
    const emptyEl = document.getElementById('electionsEmpty');
    
    let filtered = elections;
    
    // Filter by status
  
    
    if (filtered.length === 0) {
        listEl.style.display = 'none';
        emptyEl.style.display = 'block';
        return;
    }
    
    listEl.innerHTML = filtered.map(election => createElectionCard(election)).join('');
    listEl.style.display = 'flex';
    emptyEl.style.display = 'none';
    
    // Add event listeners
    document.querySelectorAll('.election-card').forEach(card => {
        card.addEventListener('click', () => viewElectionDetails(card.dataset.id));
    });
    
    document.querySelectorAll('.btn-view-details').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            viewElectionDetails(btn.dataset.id);
        });
    });
    
    document.querySelectorAll('.btn-register').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!btn.disabled) {
                openRegisterModal(btn.dataset.id);
            }
        });
    });
    
    document.querySelectorAll('.btn-vote').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!btn.disabled) {
                openVoteModal(btn.dataset.id);
            }
        });
    });
    
    document.querySelectorAll('.btn-vote-request').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!btn.disabled) {
                requestVotePermission(btn.dataset.id);
            }
        });
    });
    
    document.querySelectorAll('.btn-manage').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openElectionManagement(btn.dataset.id);
        });
    });
}

function createElectionCard(election) {
    const now = new Date();
    const regStart = new Date(election.registration_start_date);
    const regEnd = new Date(election.registration_end_date);
    const votingStart = new Date(election.voting_start_date);
    const votingEnd = new Date(election.voting_end_date);
    
    // Use the status from backend, not calculated from dates
    const status = election.status || 'draft';
    
    const daysLeft = Math.ceil((votingEnd - now) / (1000 * 60 * 60 * 24));
    
    // Check if current user is the creator
    const isCreator = currentUser && currentUser.id === election.created_by;
    
    // Get candidate and vote request status
    const userCandidateStatus = election.userCandidateStatus || null;
    const userVoteRequestStatus = election.userVoteRequestStatus || null;
    
    // Determine button states based on election STATUS and user status
    const canRegister = status === 'draft' || status === 'registration_open' || status === 'registration_closed';
    const isApprovedCandidate = userCandidateStatus === 'approved';
    const isRejectedCandidate = userCandidateStatus === 'rejected';
    const canShowRegisterBtn = canRegister && !isApprovedCandidate;
    
    // Vote request logic: show vote request first, then cast vote after approval
    const canVote = status === 'voting_open' && !election.userHasVoted;
    const hasVoted = election.userHasVoted === true;
    const voteRequestPending = userVoteRequestStatus === 'pending';
    const voteRequestApproved = userVoteRequestStatus === 'approved';
    const voteRequestRejected = userVoteRequestStatus === 'rejected';
    const canShowVoteRequestBtn = canVote && !voteRequestApproved && !hasVoted;
    const canShowCastVoteBtn = canVote && voteRequestApproved && !hasVoted;
    
    console.log(`📊 Election: ${election.title} - Status: ${status}, CandidateStatus: ${userCandidateStatus}, VoteReqStatus: ${userVoteRequestStatus}`);
    console.log(`🔘 Register: ${canShowRegisterBtn ? 'ENABLED' : 'DISABLED'} (Approved: ${isApprovedCandidate})`);
    console.log(`🗳️ Vote: VoteReq: ${userVoteRequestStatus || 'none'}, HasVoted: ${hasVoted}`);
    
    return `
        <div class="election-card" data-id="${election.id}">
            <div class="election-header">
                <div>
                    <div class="election-title">${election.title}</div>
                    <p class="election-description">${election.description || ' '}</p>
                    <div class="election-creator" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">
                        Created by: <strong>${election.created_by_name || 'Unknown'}</strong>
                    </div>
                </div>
                <span class="election-status status-${status}">${status.replace(/_/g, ' ')}</span>
            </div>
            
            <div class="election-meta">
                <div class="meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    ${election.post_count || 0} posts
                </div>
                <div class="meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    ${election.candidate_count || 0} candidates
                </div>
            </div>
            
            <div class="election-stats">
                <div class="stat">
                    <span class="stat-label">📝 Registration</span>
                    <span class="stat-value">${formatDateCompact(regStart)} - ${formatDateCompact(regEnd)}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">🗳️ Voting Period</span>
                    <span class="stat-value">${formatDateCompact(votingStart)} - ${formatDateCompact(votingEnd)}</span>
                </div>
            </div>
            
            <div class="election-actions">
                <button class="btn-action secondary btn-view-details" data-id="${election.id}">
                    View Details
                </button>
                ${isApprovedCandidate ? 
                    `<button class="btn-action btn-candidate-approved" disabled style="background: var(--success); cursor: default;">
                        ✓ Candidate Approved
                    </button>` :
                    `<button class="btn-action btn-register" data-id="${election.id}" 
                        ${!canShowRegisterBtn ? 'disabled title="' + (!canRegister ? 'Candidate registration is closed' : 'Already registered as candidate') + '"' : ''}>
                        Register as Candidate
                    </button>`
                }
                ${hasVoted ? 
                    `<button class="btn-action btn-voted" disabled style="background: var(--success); cursor: default;">
                        ✓ Voted
                    </button>` :
                    voteRequestPending ?
                    `<button class="btn-action btn-vote-pending" disabled style="background: var(--warning); cursor: default;">
                        ⏳ Vote Request Pending
                    </button>` :
                    voteRequestApproved ?
                    `<button class="btn-action btn-vote" data-id="${election.id}"
                        ${!canShowCastVoteBtn ? 'disabled title="Voting is not open"' : ''}>
                        Cast Vote
                    </button>` :
                    `<button class="btn-action btn-vote-request" data-id="${election.id}"
                        ${!canShowVoteRequestBtn ? 'disabled title="Voting is not open"' : ''}>
                        Request to Vote
                    </button>`
                }
                ${isCreator ? `<button class="btn-action btn-manage" data-id="${election.id}" style="background: var(--primary); color: white;">
                    ⚙️ Manage
                </button>` : ''}
            </div>
        </div>
    `;
}

function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString();
}

function formatDateCompact(date) {
    const d = new Date(date);
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    return `${month} ${day}`;
}

// ==================== ELECTION DETAILS ====================
async function viewElectionDetails(electionId) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        const response = await fetch(`${API_BASE}/elections/${electionId}`);
        if (!response.ok) throw new Error('Failed to load election');
        
        const data = await response.json();
        const election = data.data;
        
        // Check if results are published
        const resultsPublished = election.status === 'results_published' || election.status === 'completed';
        
        let html = `
            <div class="details-section">
                <div class="section-title">Election Information</div>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Title</span>
                        <span class="info-value">${election.title}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Status</span>
                        <span class="info-value status-badge-inline status-${election.status}">${election.status.replace(/_/g, ' ')}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Created By</span>
                        <span class="info-value">${election.created_by_name}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Posts</span>
                        <span class="info-value">${election.post_count || 0}</span>
                    </div>
                </div>
                <p style="color: var(--text-secondary); margin: 0;">
                    ${election.description || 'No description provided'}
                </p>
            </div>
        `;
        
        // Show Results if published
        if (resultsPublished) {
            try {
                // Get stats
                const statsResponse = await fetch(`${API_BASE}/elections/${electionId}/stats`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                const statsData = await statsResponse.json();
                const stats = statsData.data;
                
                // Get results
                const resultsResponse = await fetch(`${API_BASE}/elections/${electionId}/results`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                const resultsData = await resultsResponse.json();
                const results = resultsData.data || [];
                
                html += `
                    <div class="details-section">
                        <div class="section-title">🏆 Election Results</div>
                        <div class="stats-grid-small">
                            <div class="stat-card-small">
                                <div class="stat-icon-small">🗳️</div>
                                <div class="stat-value-small">${stats.total_votes || 0}</div>
                                <div class="stat-label-small">Total Votes</div>
                            </div>
                            <div class="stat-card-small">
                                <div class="stat-icon-small">👥</div>
                                <div class="stat-value-small">${stats.unique_voters || 0}</div>
                                <div class="stat-label-small">Voters</div>
                            </div>
                            <div class="stat-card-small">
                                <div class="stat-icon-small">👤</div>
                                <div class="stat-value-small">${stats.total_candidates || 0}</div>
                                <div class="stat-label-small">Candidates</div>
                            </div>
                        </div>
                `;
                
                if (results.length > 0) {
                    results.forEach((result, index) => {
                        const positionsCount = result.positions_count || 1;
                        const totalVotes = result.candidates.reduce((sum, c) => sum + c.votes, 0);
                        const winners = result.candidates.filter(c => c.is_winner);
                        
                        html += `
                            <div class="result-section">
                                <h4 class="result-post-title">
                                    <span class="post-badge">${index + 1}</span>
                                    ${result.post_name}
                                    <span class="total-votes-badge">${totalVotes} votes</span>
                                </h4>
                        `;
                        
                        if (winners.length > 0) {
                            html += '<div class="winners-showcase">';
                            winners.forEach((winner, idx) => {
                                const percentage = totalVotes > 0 ? ((winner.votes / totalVotes) * 100).toFixed(1) : 0;
                                html += `
                                    <div class="winner-showcase-card">
                                        <div class="winner-trophy">🏆</div>
                                        <div class="winner-badge-position">${idx === 0 ? '1st Place' : idx === 1 ? '2nd Place' : idx === 2 ? '3rd Place' : (idx + 1) + 'th Place'}</div>
                                        <div class="winner-showcase-name">${winner.name}</div>
                                        <div class="winner-showcase-symbol">${winner.symbol || '⭐'}</div>
                                        <div class="winner-showcase-votes">
                                            <span class="votes-count">${winner.votes}</span> votes
                                        </div>
                                        <div class="winner-showcase-percentage">${percentage}% of total votes</div>
                                    </div>
                                `;
                            });
                            html += '</div>';
                        }
                        
                        if (result.candidates.length > 0) {
                            html += '<div class="all-results-toggle" onclick="toggleResults(this)">Show all candidates ▼</div>';
                            html += '<div class="all-candidates-results" style="display: none;">';
                            result.candidates.forEach((candidate, idx) => {
                                const percentage = totalVotes > 0 ? ((candidate.votes / totalVotes) * 100).toFixed(1) : 0;
                                html += `
                                    <div class="candidate-result-small ${candidate.is_winner ? 'winner' : ''}">
                                        <span class="candidate-rank-small">${idx + 1}</span>
                                        <span class="candidate-name-small">${candidate.name}</span>
                                        <div class="vote-bar-small">
                                            <div class="vote-fill-small" style="width: ${percentage}%"></div>
                                        </div>
                                        <span class="candidate-votes-small">${candidate.votes} (${percentage}%)</span>
                                    </div>
                                `;
                            });
                            html += '</div>';
                        }
                        
                        html += '</div>'; // Close result-section
                    });
                } else {
                    html += '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No votes cast yet</p>';
                }
                
                html += '</div>'; // Close details-section
            } catch (err) {
                console.error('Error loading results:', err);
                html += '<div class="details-section"><p style="color: var(--danger);">Error loading results</p></div>';
            }
        } else {
            // Show Posts section with candidate count if results not published
            // Load voter stats
            try {
                const statsResponse = await fetch(`${API_BASE}/elections/${electionId}/stats`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                if (statsResponse.ok) {
                    const statsData = await statsResponse.json();
                    const stats = statsData.data;
                    
                    html += `
                        <div class="details-section">
                            <div class="section-title">👥 Voting Status</div>
                            <div class="stats-grid-small">
                                <div class="stat-card-small">
                                    <div class="stat-icon-small">✅</div>
                                    <div class="stat-value-small">${stats.unique_voters || 0}/${stats.approved_voters || 0}</div>
                                    <div class="stat-label-small">Voted/Approved</div>
                                </div>
                                <div class="stat-card-small">
                                    <div class="stat-icon-small">👤</div>
                                    <div class="stat-value-small">${stats.total_candidates || 0}</div>
                                    <div class="stat-label-small">Candidates</div>
                                </div>
                                <div class="stat-card-small">
                                    <div class="stat-icon-small">📋</div>
                                    <div class="stat-value-small">${stats.total_votes || 0}</div>
                                    <div class="stat-label-small">Total Votes</div>
                                </div>
                            </div>
                        </div>
                    `;
                }
            } catch (err) {
                console.log('Could not load stats:', err);
            }
            
            html += `
                <div class="details-section">
                    <div class="section-title">Posts & Candidates</div>
                    <div class="posts-list">
            `;
            
            if (election.posts && election.posts.length > 0) {
                for (const post of election.posts) {
                    // Fetch candidates for this post
                    try {
                        const candidatesResponse = await fetch(
                            `${API_BASE}/elections/${electionId}/posts/${post.id}/candidates`,
                            { headers: token ? { 'Authorization': `Bearer ${token}` } : {} }
                        );
                        
                        let candidatesHtml = '';
                        if (candidatesResponse.ok) {
                            const candData = await candidatesResponse.json();
                            const candidates = candData.data || [];
                            
                            if (candidates.length > 0) {
                                candidatesHtml = '<div class="candidates-list-inline">';
                                for (const candidate of candidates) {
                                    candidatesHtml += `
                                        <div class="candidate-item-inline">
                                            <div class="candidate-symbol-inline">${candidate.election_symbol || '⭐'}</div>
                                            <div class="candidate-info-inline">
                                                <div class="candidate-name-inline">${candidate.name}</div>
                                                <div class="candidate-username-inline">@${candidate.username || 'user'}</div>
                                                ${candidate.quote ? `<div class="candidate-quote-inline">"${candidate.quote}"</div>` : ''}
                                            </div>
                                            <span class="candidate-status-badge">✓ Approved</span>
                                        </div>
                                    `;
                                }
                                candidatesHtml += '</div>';
                            } else {
                                candidatesHtml = '<p style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">No approved candidates yet</p>';
                            }
                        }
                        
                        html += `
                            <div class="post-item">
                                <div class="post-item-name">${post.post_name}</div>
                                ${candidatesHtml}
                            </div>
                        `;
                    } catch (err) {
                        console.error('Error loading candidates for post:', post.id, err);
                        html += `
                            <div class="post-item">
                                <div class="post-item-name">${post.post_name}</div>
                                <p style="font-size: 12px; color: var(--text-secondary);">Could not load candidates</p>
                            </div>
                        `;
                    }
                }
            } else {
                html += '<p style="color: var(--text-secondary);">No posts configured</p>';
            }
            
            html += `
                    </div>
                </div>
            `;
        }
        
        html += `
            <div class="details-section">
                <div class="section-title">Schedule</div>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Registration Starts</span>
                        <span class="info-value">${formatDate(election.registration_start_date)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Registration Ends</span>
                        <span class="info-value">${formatDate(election.registration_end_date)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Voting Starts</span>
                        <span class="info-value">${formatDate(election.voting_start_date)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Voting Ends</span>
                        <span class="info-value">${formatDate(election.voting_end_date)}</span>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('detailsTitle').textContent = election.title;
        document.getElementById('detailsContent').innerHTML = html;
        document.getElementById('electionDetailsModal').style.display = 'flex';
    } catch (err) {
        console.error('Error loading election details:', err);
        showAlert('Failed to load election details', 'danger');
    }
}

// Toggle all candidates results
function toggleResults(element) {
    const resultsDiv = element.nextElementSibling;
    if (resultsDiv.style.display === 'none') {
        resultsDiv.style.display = 'block';
        element.textContent = 'Hide all candidates ▲';
    } else {
        resultsDiv.style.display = 'none';
        element.textContent = 'Show all candidates ▼';
    }
}

// ==================== CANDIDATE REGISTRATION ====================
async function openRegisterModal(electionId) {
    // Check if user is authenticated
    if (!currentUser || !currentUser.id) {
        showAlert('You must be logged in to register as a candidate', 'danger');
        return;
    }

    // Check if user has candidate label
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        const response = await fetch(`${API_BASE}/profile/${currentUser.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache' // Force fresh data
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Profile data:', data.data);
            
            // Check labels field
            const labels = data.data.labels ? data.data.labels.split(',').map(l => l.trim().toLowerCase()) : [];
            console.log('User labels:', labels);
            console.log('Checking for candidate:', labels.includes('candidate'));
            
            if (!labels.includes('candidate')) {
                // Don't block on frontend - let backend validate
                console.warn('⚠️ Candidate label not found in profile. Backend will validate.');
            }
        } else {
            console.warn('Profile fetch warning:', response.status, response.statusText);
            // Don't block - let backend validation handle it
        }
    } catch (err) {
        console.warn('Warning checking candidate label:', err);
        // Don't block on error - let backend validate
    }
    
    try {
        const response = await fetch(`${API_BASE}/elections/${electionId}`);
        if (!response.ok) throw new Error('Failed to load election');
        
        const data = await response.json();
        const election = data.data;
        
        // Check election status - candidate registration only when voting is NOT open
        const status = election.status || 'draft';
        if (status === 'voting_open' || status === 'voting_closed' || status === 'completed') {
            showAlert('Candidate registration is closed. Election is already in voting or completed stage.', 'danger');
            return;
        }
        
        document.getElementById('candidateElectionId').value = electionId;
        
        // Create post selector
        let postsHtml = '<div class="form-group"><label>Select Post <span class="required">*</span></label><select id="candidatePostSelect" required>';
        
        if (election.posts && election.posts.length > 0) {
            for (const post of election.posts) {
                postsHtml += `<option value="${post.id}">${post.post_name}</option>`;
            }
        }
        
        postsHtml += '</select></div>';
        
        // Clear any existing post selector
        const oldSelector = document.getElementById('candidatePostSelector');
        if (oldSelector) oldSelector.remove();
        
        // Add post selector as first element
        const form = document.getElementById('registerCandidateForm');
        const symbolField = form.querySelector('#candidateSymbol').parentElement;
        const selector = document.createElement('div');
        selector.id = 'candidatePostSelector';
        selector.innerHTML = postsHtml;
        symbolField.parentElement.insertBefore(selector, symbolField);
        
        document.getElementById('registerCandidateModal').style.display = 'flex';
    } catch (err) {
        console.error('Error opening register modal:', err);
        showAlert('Failed to open registration form: ' + err.message, 'danger');
    }
}

document.getElementById('registerCandidateForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const electionId = document.getElementById('candidateElectionId').value;
    const postSelect = document.getElementById('candidatePostSelect');
    const postId = postSelect ? postSelect.value : null;
    const symbol = document.getElementById('candidateSymbol').value;
    const quote = document.getElementById('candidateQuote').value;
    const bio = document.getElementById('candidateBio').value;
    
    if (!postId) {
        showAlert('Please select a post', 'danger');
        return;
    }
    
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        const response = await fetch(`${API_BASE}/elections/${electionId}/candidates`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                post_id: parseInt(postId),
                election_id: parseInt(electionId),
                election_symbol: symbol,
                quote,
                biography: bio
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            console.error('❌ Registration failed:', {
                status: response.status,
                message: err.message,
                error: err
            });
            
            // If it's a 403 with label issue, suggest logout
            if (response.status === 403 && err.message.includes('candidate')) {
                console.warn('⚠️ Label check failed. Showing logout suggestion...');
                const logoutSuggestion = `${err.message}\n\nWould you like to log out and log back in to refresh your session?`;
                if (confirm(logoutSuggestion)) {
                    // Clear tokens and redirect to login
                    localStorage.removeItem('token');
                    localStorage.removeItem('Swe_Society_token');
                    localStorage.removeItem('currentUser');
                    window.location.href = '/Auth/login.html';
                    return;
                }
            }
            
            throw new Error(err.message || 'Registration failed');
        }
        
        showAlert('✅ Registration submitted! Awaiting panel approval', 'success');
        setTimeout(() => {
            document.getElementById('registerCandidateModal').style.display = 'none';
            document.getElementById('registerCandidateForm').reset();
            // Remove dynamically added post selector
            const selector = document.getElementById('candidatePostSelector');
            if (selector) selector.remove();
        }, 1500);
    } catch (err) {
        console.error('Error registering:', err);
        showAlert('❌ ' + (err.message || 'Failed to register'), 'danger');
    }
});

// ==================== VOTING ====================
// Request vote permission from the panel
async function requestVotePermission(electionId) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        if (!token) {
            showAlert('Authentication required. Please login again.', 'danger');
            return;
        }
        
        console.log('📝 Requesting vote permission for election:', electionId);
        
        const response = await fetch(`${API_BASE}/elections/${electionId}/vote-request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ election_id: parseInt(electionId) })
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'Failed to request vote permission');
        }
        
        console.log('✅ Vote permission requested');
        showAlert('✅ Vote request submitted! Awaiting panel approval', 'success');
        
        // Reload elections to update button state
        setTimeout(() => {
            loadElections();
        }, 1500);
    } catch (err) {
        console.error('❌ Error requesting vote permission:', err);
        showAlert('❌ ' + (err.message || 'Failed to request vote permission'), 'danger');
    }
}

async function openVoteModal(electionId) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        if (!token) {
            console.error('❌ No token found for voting');
            showAlert('Authentication required. Please login again.', 'danger');
            return;
        }
        
        // Get election details to check status
        const electionResponse = await fetch(`${API_BASE}/elections/${electionId}`);
        if (!electionResponse.ok) throw new Error('Failed to load election');
        
        const electionData = await electionResponse.json();
        const election = electionData.data;
        
        // Check if voting is open based on election status
        const status = election.status || 'draft';
        
        if (status !== 'voting_open') {
            if (status === 'draft' || status === 'registration_open' || status === 'registration_closed') {
                showAlert('Voting has not started yet. Please wait until voting opens.', 'info');
            } else if (status === 'voting_closed' || status === 'completed') {
                showAlert('Voting has ended. You can no longer cast your vote.', 'info');
            } else {
                showAlert('Voting is not available at this time.', 'info');
            }
            return;
        }
        
        // First check if user has vote permission
        const requests = await fetch(`${API_BASE}/elections/${electionId}/vote-requests`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!requests.ok) {
            console.error('Failed to check vote permission:', requests.status);
            showAlert('Failed to check vote permission', 'danger');
            return;
        }

        const data = await requests.json();
        // Handle both array format and grouped format
        let allRequests = [];
        if (Array.isArray(data.data)) {
            allRequests = data.data;
        } else if (data.data && typeof data.data === 'object') {
            // If grouped by status, flatten into array
            Object.values(data.data).forEach(arr => {
                if (Array.isArray(arr)) allRequests = allRequests.concat(arr);
            });
        }
        
        const userRequest = allRequests.find(r => r.user_id === currentUser.id);

        if (!userRequest) {
            // Allow vote approval request during voting period
            console.log('📝 Requesting voting permission...');
            const reqResponse = await fetch(`${API_BASE}/elections/${electionId}/vote-request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ election_id: parseInt(electionId) })
            });

            if (!reqResponse.ok) {
                const errData = await reqResponse.json();
                console.error('❌ Vote request failed:', {
                    status: reqResponse.status,
                    message: errData.message,
                    error: errData
                });
                throw new Error(errData.message || 'Failed to request vote');
            }

            console.log('✅ Vote request submitted');
            showAlert('Vote request submitted! Awaiting panel approval', 'info');
            return;
        }

        if (userRequest.status !== 'approved') {
            console.log('⏳ Vote request pending approval');
            showAlert('Your vote request is pending approval', 'info');
            return;
        }
        
        // Check if user has already voted
        const votesCheckResponse = await fetch(`${API_BASE}/elections/${electionId}/votes/check`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (votesCheckResponse.ok) {
            const votesCheckData = await votesCheckResponse.json();
            if (votesCheckData.hasVoted) {
                showAlert('You have already cast your vote in this election. Multiple voting is not allowed.', 'warning');
                return;
            }
        }
        
        console.log('🗳️ Loading voting interface...');
        
        let votingHtml = `
            <div class="voting-header">
                <h3>🗳️ Cast Your Vote</h3>
                <p class="voting-instruction">Select <strong>one candidate</strong> for each position. You must vote for all positions to submit.</p>
            </div>
        `;
        
        let totalPosts = 0;
        
        if (election.posts && election.posts.length > 0) {
            for (const post of election.posts) {
                // Get candidates for this post
                const candidatesResponse = await fetch(
                    `${API_BASE}/elections/${electionId}/posts/${post.id}/candidates`
                );
                if (!candidatesResponse.ok) {
                    console.warn('Failed to load candidates for post:', post.id);
                    continue;
                }
                const candidatesData = await candidatesResponse.json();
                const candidates = candidatesData.data || [];
                
                if (candidates.length === 0) continue;
                
                totalPosts++;
                
                votingHtml += `
                    <div class="voting-post" data-post-id="${post.id}">
                        <div class="voting-post-header">
                            <h4 class="voting-post-name"><span class="post-number">${totalPosts}</span> ${post.post_name}</h4>
                            <span class="vote-status" id="status_${post.id}">Not selected</span>
                        </div>
                        <div class="voting-options">
                `;
                
                for (const candidate of candidates) {
                    const approvalBadge = candidate.status === 'approved' ? '<span class="approval-badge approved">✓ Approved</span>' : '';
                    votingHtml += `
                        <label class="vote-option" data-post="${post.id}" data-candidate="${candidate.id}">
                            <input type="radio" name="post_${post.id}" value="${candidate.id}" 
                                   data-post-id="${post.id}" data-candidate-id="${candidate.id}"
                                   onchange="updateVoteStatus(${post.id})">
                            <div class="vote-option-content">
                                <div class="candidate-symbol">${candidate.election_symbol || '🗳️'}</div>
                                <div class="candidate-info-wrapper">
                                    <div class="candidate-name">${candidate.name}</div>
                                    <div class="candidate-username">@${candidate.username || 'user'}</div>
                                    ${approvalBadge}
                                    ${candidate.quote ? `<div class="candidate-quote">"${candidate.quote}"</div>` : ''}
                                </div>
                            </div>
                            <div class="radio-check"></div>
                        </label>
                    `;
                }
                
                votingHtml += `
                        </div>
                    </div>
                `;
            }
        }
        
        votingHtml += `
            <div class="voting-summary" id="votingSummary">
                <span id="voteCount">0 of ${totalPosts} positions selected</span>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('voteModal').style.display='none'">Cancel</button>
                <button type="button" class="btn btn-primary" id="submitVoteBtn" onclick="submitVotes(${electionId}, ${totalPosts})">Submit Votes</button>
            </div>
        `;
        
        document.getElementById('voteContent').innerHTML = votingHtml;
        document.getElementById('voteModal').style.display = 'flex';
        
        // Add event listeners for radio selection styling
        document.querySelectorAll('.vote-option input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', function() {
                const postId = this.dataset.postId;
                document.querySelectorAll(`label[data-post="${postId}"]`).forEach(label => {
                    label.classList.remove('selected');
                });
                this.closest('.vote-option').classList.add('selected');
            });
        });
    } catch (err) {
        console.error('Error opening vote modal:', err);
        showAlert(err.message || 'Failed to open voting interface', 'danger');
    }
}

// Update vote status display
function updateVoteStatus(postId) {
    const statusEl = document.getElementById(`status_${postId}`);
    if (statusEl) {
        statusEl.textContent = '✓ Selected';
        statusEl.style.color = 'var(--success)';
    }
    
    // Update vote count
    const totalPosts = document.querySelectorAll('.voting-post').length;
    const selectedPosts = document.querySelectorAll('input[type="radio"]:checked').length;
    const countEl = document.getElementById('voteCount');
    if (countEl) {
        countEl.textContent = `${selectedPosts} of ${totalPosts} positions selected`;
        if (selectedPosts === totalPosts) {
            countEl.style.color = 'var(--success)';
            countEl.style.fontWeight = '600';
        }
    }
}

async function submitVotes(electionId, totalPosts) {
    const votes = [];
    const radioButtons = document.querySelectorAll('input[type="radio"]:checked');
    
    // Validate that all posts have been voted on
    if (radioButtons.length === 0) {
        showAlert('Please select at least one candidate to vote', 'danger');
        return;
    }
    
    if (radioButtons.length < totalPosts) {
        showAlert(`You must vote for all ${totalPosts} positions. Currently selected: ${radioButtons.length}`, 'warning');
        return;
    }
    
    for (const radio of radioButtons) {
        votes.push({
            post_id: parseInt(radio.dataset.postId),
            candidate_id: parseInt(radio.dataset.candidateId)
        });
    }
    
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        if (!token) {
            console.error('❌ No token found for vote submission');
            showAlert('Authentication required. Please login again.', 'danger');
            return;
        }
        
        console.log('🗳️ Submitting votes for election:', electionId);
        for (const vote of votes) {
            console.log('Casting vote for post:', vote.post_id, 'candidate:', vote.candidate_id);
            const response = await fetch(`${API_BASE}/elections/${electionId}/vote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    election_id: parseInt(electionId),
                    post_id: vote.post_id,
                    candidate_id: vote.candidate_id
                })
            });
            
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Failed to cast vote');
            }
        }
        
        console.log('✅ Votes submitted successfully');
        showAlert('Votes submitted successfully!', 'success');
        setTimeout(() => {
            document.getElementById('voteModal').style.display = 'none';
            loadElections();
        }, 1500);
    } catch (err) {
        console.error('❌ Error submitting votes:', err);
        showAlert('❌ ' + (err.message || 'Failed to submit votes'), 'danger');
    }
}

// ==================== ELECTION MANAGEMENT ====================
async function openElectionManagement(electionId) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        if (!token) {
            showAlert('Authentication required', 'danger');
            return;
        }
        
        // Fetch election details
        const response = await fetch(`${API_BASE}/elections/${electionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load election');
        
        const data = await response.json();
        const election = data.data;
        
        // Verify user is the creator
        if (currentUser.id !== election.created_by) {
            showAlert('❌ You can only manage elections you created', 'danger');
            return;
        }
        
        // Build management UI
        let managementHtml = `
            <div class="management-tabs">
                <button class="management-tab-btn active" data-tab="overview">Overview</button>
                <button class="management-tab-btn" data-tab="candidates">Candidates</button>
                <button class="management-tab-btn" data-tab="voters">Voters</button>
                <button class="management-tab-btn" data-tab="actions">Actions</button>
            </div>
            
            <div id="managementTabs">
                <!-- Overview Tab -->
                <div class="management-tab" data-tab="overview" style="display: block;">
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Status</span>
                            <span class="info-value">${election.status}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Posts</span>
                            <span class="info-value">${election.post_count || 0}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Candidates</span>
                            <span class="info-value">${election.candidate_count || 0}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Candidates Tab -->
                <div class="management-tab" data-tab="candidates">
                    <div id="candidatesManagement">Loading candidates...</div>
                </div>
                
                <!-- Voters Tab -->
                <div class="management-tab" data-tab="voters">
                    <div id="votersManagement">Loading voters...</div>
                </div>
                
                <!-- Actions Tab -->
                <div class="management-tab" data-tab="actions">
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px;">
                        <button class="btn btn-warning" onclick="openEditElection(${electionId})">✏️ Edit Election</button>
                        <button class="btn btn-info" onclick="openRegistration(${electionId})">Open Registration</button>
                        <button class="btn btn-primary" onclick="openVoting(${electionId})">Open Voting</button>
                        <button class="btn btn-success" onclick="closeVoting(${electionId})">Close Voting</button>
                        <button class="btn" onclick="publishResults(${electionId})">Publish Results</button>
                        <button class="btn btn-danger" onclick="deleteElectionConfirm(${electionId})">Delete Election</button>
                    </div>
                    <div style="margin-top: 20px;">
                        <button class="btn btn-secondary" onclick="loadVoterLogs(${electionId})" style="width: 100%;">
                            📋 View Voter Logs
                        </button>
                        <div id="voterLogsContainer" style="margin-top: 15px; display: none;">
                            <div class="section-title" style="margin-bottom: 10px;">Voter Logs</div>
                            <div id="voterLogsContent">Loading...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('managementContent').innerHTML = managementHtml;
        
        // Setup tab switching
        document.querySelectorAll('.management-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.management-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.management-tab').forEach(t => t.style.display = 'none');
                btn.classList.add('active');
                const tab = document.querySelector(`.management-tab[data-tab="${btn.dataset.tab}"]`);
                if (tab) tab.style.display = 'block';
                
                // Load data for the tab
                if (btn.dataset.tab === 'candidates') {
                    loadManagementCandidates(electionId);
                } else if (btn.dataset.tab === 'voters') {
                    loadManagementVoters(electionId);
                }
            });
        });
        
        document.getElementById('managementModal').style.display = 'flex';
    } catch (err) {
        console.error('Error opening management:', err);
        showAlert(err.message || 'Failed to open management panel', 'danger');
    }
}

async function loadManagementCandidates(electionId) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        const response = await fetch(`${API_BASE}/elections/${electionId}/candidates`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load candidates');
        
        const data = await response.json();
        const grouped = data.data || {};
        
        // Get candidates from grouped data
        const pending = grouped.pending_approval || [];
        const approved = grouped.approved || [];
        const rejected = grouped.rejected || [];
        
        let html = '<div class="candidates-management-container">';
        
        // Pending Approval Section
        html += `
            <div class="candidate-section">
                <h4 class="section-title">
                    <span class="status-badge status-pending">Pending Approval</span>
                    <span class="count-badge">${pending.length}</span>
                </h4>
                <div class="candidates-grid">
                    ${pending.length === 0 
                        ? '<div class="empty-section">No candidates pending approval</div>' 
                        : pending.map(cand => renderCandidateCard(cand, electionId, 'pending')).join('')
                    }
                </div>
            </div>
        `;
        
        // Approved Section
        html += `
            <div class="candidate-section">
                <h4 class="section-title">
                    <span class="status-badge status-approved">Approved</span>
                    <span class="count-badge">${approved.length}</span>
                </h4>
                <div class="candidates-grid">
                    ${approved.length === 0 
                        ? '<div class="empty-section">No approved candidates</div>' 
                        : approved.map(cand => renderCandidateCard(cand, electionId, 'approved')).join('')
                    }
                </div>
            </div>
        `;
        
        // Rejected Section
        html += `
            <div class="candidate-section">
                <h4 class="section-title">
                    <span class="status-badge status-rejected">Rejected</span>
                    <span class="count-badge">${rejected.length}</span>
                </h4>
                <div class="candidates-grid">
                    ${rejected.length === 0 
                        ? '<div class="empty-section">No rejected candidates</div>' 
                        : rejected.map(cand => renderCandidateCard(cand, electionId, 'rejected')).join('')
                    }
                </div>
            </div>
        `;
        
        html += '</div>';
        document.getElementById('candidatesManagement').innerHTML = html;
    } catch (err) {
        console.error('Error loading candidates:', err);
        document.getElementById('candidatesManagement').innerHTML = `<p style="color: red;">Error loading candidates: ${err.message}</p>`;
    }
}

function renderCandidateCard(candidate, electionId, status) {
    return `
        <div class="candidate-card">
            <div class="card-header">
                <div class="card-title">
                    <h5>${candidate.name || 'Unknown'}</h5>
                    <span class="post-name">${candidate.post_name || 'N/A'}</span>
                </div>
                <span class="status-badge status-${status}">${status}</span>
            </div>
            
            <div class="card-body">
                <div class="candidate-info">
                    <div class="info-row">
                        <label>Email:</label>
                        <span>${candidate.email || 'N/A'}</span>
                    </div>
                    <div class="info-row">
                        <label>Bio:</label>
                        <span class="bio-text">${candidate.biography || candidate.bio || 'No bio provided'}</span>
                    </div>
                    ${candidate.tagline ? `
                        <div class="info-row">
                            <label>Tagline:</label>
                            <span>${candidate.tagline}</span>
                        </div>
                    ` : ''}
                    ${candidate.election_symbol ? `
                        <div class="info-row">
                            <label>Symbol:</label>
                            <span>${candidate.election_symbol}</span>
                        </div>
                    ` : ''}
                    ${candidate.quote ? `
                        <div class="info-row">
                            <label>Quote:</label>
                            <span class="quote-text">"${candidate.quote}"</span>
                        </div>
                    ` : ''}
                    <div class="info-row">
                        <label>Registered:</label>
                        <span>${new Date(candidate.registration_timestamp).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
            
            <div class="card-actions">
                ${status === 'pending' ? `
                    <button class="btn btn-small btn-success" onclick="approveCandidate(${candidate.id}, ${electionId})">✓ Approve</button>
                    <button class="btn btn-small btn-danger" onclick="rejectCandidate(${candidate.id}, ${electionId})">✕ Reject</button>
                ` : ''}
                ${status !== 'pending' ? `
                    <button class="btn btn-small btn-outline-danger" onclick="deleteCandidateConfirm(${candidate.id}, ${electionId})">🗑️ Delete</button>
                ` : ''}
            </div>
        </div>
    `;
}

async function loadManagementVoters(electionId) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        const response = await fetch(`${API_BASE}/elections/${electionId}/vote-requests`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load voters');
        
        const data = await response.json();
        const requests = data.data || [];
        
        // Group voters by status
        const pending = requests.filter(r => r.status === 'pending');
        const approved = requests.filter(r => r.status === 'approved');
        const rejected = requests.filter(r => r.status === 'rejected');
        
        let html = '<div class="voters-management-container">';
        
        // Pending Approval Section
        html += `
            <div class="voter-section">
                <h4 class="section-title">
                    <span class="status-badge status-pending">Pending Approval</span>
                    <span class="count-badge">${pending.length}</span>
                </h4>
                <div class="voters-grid">
                    ${pending.length === 0 
                        ? '<div class="empty-section">No pending voter requests</div>' 
                        : pending.map(voter => renderVoterCard(voter, electionId, 'pending')).join('')
                    }
                </div>
            </div>
        `;
        
        // Approved Section
        html += `
            <div class="voter-section">
                <h4 class="section-title">
                    <span class="status-badge status-approved">Approved</span>
                    <span class="count-badge">${approved.length}</span>
                </h4>
                <div class="voters-grid">
                    ${approved.length === 0 
                        ? '<div class="empty-section">No approved voters</div>' 
                        : approved.map(voter => renderVoterCard(voter, electionId, 'approved')).join('')
                    }
                </div>
            </div>
        `;
        
        // Rejected Section
        html += `
            <div class="voter-section">
                <h4 class="section-title">
                    <span class="status-badge status-rejected">Rejected</span>
                    <span class="count-badge">${rejected.length}</span>
                </h4>
                <div class="voters-grid">
                    ${rejected.length === 0 
                        ? '<div class="empty-section">No rejected voters</div>' 
                        : rejected.map(voter => renderVoterCard(voter, electionId, 'rejected')).join('')
                    }
                </div>
            </div>
        `;
        
        html += '</div>';
        document.getElementById('votersManagement').innerHTML = html;
    } catch (err) {
        console.error('Error loading voters:', err);
        document.getElementById('votersManagement').innerHTML = `<p style="color: red;">Error loading voters: ${err.message}</p>`;
    }
}

function renderVoterCard(voter, electionId, status) {
    return `
        <div class="voter-card">
            <div class="card-header">
                <div class="card-title">
                    <h5>${voter.name || 'Unknown'}</h5>
                    <span class="username">@${voter.username || 'N/A'}</span>
                </div>
                <span class="status-badge status-${status}">${status}</span>
            </div>
            
            <div class="card-body">
                <div class="voter-info">
                    <div class="info-row">
                        <label>Email:</label>
                        <span>${voter.email || 'N/A'}</span>
                    </div>
                    <div class="info-row">
                        <label>Requested:</label>
                        <span>${new Date(voter.requested_at).toLocaleDateString()}</span>
                    </div>
                    ${voter.approved_at ? `
                        <div class="info-row">
                            <label>Approved:</label>
                            <span>${new Date(voter.approved_at).toLocaleDateString()}</span>
                        </div>
                    ` : ''}
                    ${voter.rejection_reason ? `
                        <div class="info-row">
                            <label>Reason:</label>
                            <span class="rejection-text">${voter.rejection_reason}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="card-actions">
                ${status === 'pending' ? `
                    <button class="btn btn-small btn-success" onclick="approveVoter(${voter.id}, ${electionId})">✓ Approve</button>
                    <button class="btn btn-small btn-danger" onclick="rejectVoter(${voter.id}, ${electionId})">✕ Reject</button>
                ` : ''}
            </div>
        </div>
    `;
}

async function loadManagementResults(electionId) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        
        console.log('📊 Loading results for election:', electionId);
        
        // Get election details
        const electionResponse = await fetch(`${API_BASE}/elections/${electionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!electionResponse.ok) {
            throw new Error('Failed to load election details');
        }
        
        const electionData = await electionResponse.json();
        const election = electionData.data;
        console.log('✅ Election loaded:', election);
        
        // Get election stats
        const statsResponse = await fetch(`${API_BASE}/elections/${electionId}/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!statsResponse.ok) {
            console.error('❌ Stats response failed:', statsResponse.status);
            throw new Error('Failed to load election stats');
        }
        
        const statsData = await statsResponse.json();
        const stats = statsData.data;
        console.log('✅ Stats loaded:', stats);
        
        // Check if voting has started
        const votingActive = election.status === 'voting_open' || election.status === 'voting_closed' || election.status === 'completed' || election.status === 'results_published';
        
        if (!votingActive) {
            document.getElementById('resultsManagement').innerHTML = `
                <div class="results-not-started">
                    <div class="info-box">
                        <div class="info-icon">⏰</div>
                        <h4>Voting Not Started Yet</h4>
                        <p>Results will be available once voting starts on ${new Date(election.voting_start_date).toLocaleString()}</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Get results
        const response = await fetch(`${API_BASE}/elections/${electionId}/results`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            console.error('❌ Results response failed:', response.status);
            throw new Error('Failed to load results');
        }
        
        const data = await response.json();
        const results = data.data || [];
        console.log('✅ Results loaded:', results);
        
        let html = '<div class="results-management-container">';
        
        // Election Statistics Section
        html += `
            <div class="election-stats-section">
                <h3 class="section-header">📊 Election Statistics</h3>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">🗳️</div>
                        <div class="stat-value">${stats.total_votes || 0}</div>
                        <div class="stat-label">Total Votes Cast</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">👥</div>
                        <div class="stat-value">${stats.unique_voters || 0}</div>
                        <div class="stat-label">Total Voters</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">👤</div>
                        <div class="stat-value">${stats.total_candidates || 0}</div>
                        <div class="stat-label">Total Candidates</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">📋</div>
                        <div class="stat-value">${election.post_count || 0}</div>
                        <div class="stat-label">Positions</div>
                    </div>
                </div>
            </div>
        `;
        
        // Results by Position Section
        if (results.length === 0) {
            html += '<div class="results-empty"><p>No votes have been cast yet</p></div>';
        } else {
            html += '<div class="results-by-position"><h3 class="section-header">🏆 Results by Position</h3>';
            
            results.forEach((result, index) => {
                const positionsCount = result.positions_count || 1;
                const totalVotes = result.candidates.reduce((sum, c) => sum + c.votes, 0);
                
                html += `
                    <div class="result-post-card">
                        <div class="post-header">
                            <div class="post-title-wrapper">
                                <span class="post-number">${index + 1}</span>
                                <h4 class="post-title">${result.post_name}</h4>
                            </div>
                            <div class="post-meta">
                                <span class="positions-badge">${positionsCount} position${positionsCount > 1 ? 's' : ''}</span>
                                <span class="votes-badge">${totalVotes} total votes</span>
                            </div>
                        </div>
                `;
                
                if (result.candidates.length === 0) {
                    html += '<div class="no-candidates">No candidates for this position</div>';
                } else {
                    // Winners Section
                    const winners = result.candidates.filter(c => c.is_winner);
                    if (winners.length > 0) {
                        html += `
                            <div class="winners-section">
                                <h5 class="subsection-title">🏆 Winner${winners.length > 1 ? 's' : ''}</h5>
                                <div class="winners-grid">
                                    ${winners.map((winner, idx) => `
                                        <div class="winner-card">
                                            <div class="winner-rank">#${idx + 1}</div>
                                            <div class="winner-symbol">${winner.symbol || '🏆'}</div>
                                            <div class="winner-info">
                                                <div class="winner-name">${winner.name}</div>
                                                <div class="winner-username">@${winner.username}</div>
                                                ${winner.quote ? `<div class="winner-quote">"${winner.quote}"</div>` : ''}
                                            </div>
                                            <div class="winner-votes">
                                                <span class="votes-number">${winner.votes}</span>
                                                <span class="votes-label">vote${winner.votes !== 1 ? 's' : ''}</span>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    }
                    
                    // All Candidates Results
                    html += `
                        <div class="all-candidates-section">
                            <h5 class="subsection-title">📊 All Candidates</h5>
                            <div class="candidates-results-list">
                                ${result.candidates.map((candidate, idx) => {
                                    const percentage = totalVotes > 0 ? ((candidate.votes / totalVotes) * 100).toFixed(1) : 0;
                                    return `
                                        <div class="candidate-result-row ${candidate.is_winner ? 'winner-row' : ''}">
                                            <div class="candidate-rank-col">
                                                <span class="rank-badge ${candidate.is_winner ? 'winner-rank' : ''}">${idx + 1}</span>
                                            </div>
                                            <div class="candidate-info-col">
                                                <div class="candidate-name-result">${candidate.name}</div>
                                                <div class="candidate-username-result">@${candidate.username}</div>
                                            </div>
                                            <div class="candidate-votes-col">
                                                <div class="vote-bar-container">
                                                    <div class="vote-bar" style="width: ${percentage}%"></div>
                                                </div>
                                                <div class="vote-stats">
                                                    <span class="vote-count-result">${candidate.votes} votes</span>
                                                    <span class="vote-percentage">${percentage}%</span>
                                                </div>
                                            </div>
                                            ${candidate.is_winner ? '<div class="winner-icon">🏆</div>' : ''}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }
                
                html += '</div>'; // Close result-post-card
            });
            
            html += '</div>'; // Close results-by-position
        }
        
        html += '</div>'; // Close results-management-container
        document.getElementById('resultsManagement').innerHTML = html;
    } catch (err) {
        console.error('Error loading results:', err);
        document.getElementById('resultsManagement').innerHTML = `<div class="error-message"><p>Error loading results: ${err.message}</p></div>`;
    }
}

async function approveCandidate(candidateId, electionId) {
    if (!confirm('Approve this candidate?')) return;
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        const response = await fetch(`${API_BASE}/elections/candidates/${candidateId}/approve`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to approve');
        showAlert('✅ Candidate approved', 'success');
        loadManagementCandidates(electionId);
    } catch (err) {
        showAlert('Error: ' + err.message, 'danger');
    }
}

async function rejectCandidate(candidateId, electionId) {
    if (!confirm('Reject this candidate?')) return;
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        const response = await fetch(`${API_BASE}/elections/candidates/${candidateId}/reject`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to reject');
        showAlert('✅ Candidate rejected', 'success');
        loadManagementCandidates(electionId);
    } catch (err) {
        showAlert('Error: ' + err.message, 'danger');
    }
}

async function deleteCandidateConfirm(candidateId, electionId) {
    if (!confirm('Delete this candidate? This action cannot be undone.')) return;
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        const response = await fetch(`${API_BASE}/elections/candidates/${candidateId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to delete');
        showAlert('✅ Candidate deleted', 'success');
        loadManagementCandidates(electionId);
    } catch (err) {
        showAlert('Error: ' + err.message, 'danger');
    }
}

async function approveVoter(requestId, electionId) {
    if (!confirm('Approve this voter?')) return;
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        const response = await fetch(`${API_BASE}/elections/vote-requests/${requestId}/approve`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to approve');
        showAlert('✅ Voter approved', 'success');
        loadManagementVoters(electionId);
    } catch (err) {
        showAlert('Error: ' + err.message, 'danger');
    }
}

async function rejectVoter(requestId, electionId) {
    if (!confirm('Reject this voter?')) return;
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        const response = await fetch(`${API_BASE}/elections/vote-requests/${requestId}/reject`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to reject');
        showAlert('✅ Voter rejected', 'success');
        loadManagementVoters(electionId);
    } catch (err) {
        showAlert('Error: ' + err.message, 'danger');
    }
}

// ==================== STATUS MANAGEMENT ====================
async function openRegistration(electionId) {
    if (!confirm('Open candidate registration for this election?')) return;
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        if (!token) {
            throw new Error('Authentication required');
        }
        
        const response = await fetch(`${API_BASE}/elections/${electionId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'registration_open' })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to open registration');
        }
        
        showAlert('✅ Candidate registration opened successfully', 'success');
        loadElections();
        document.getElementById('managementModal').style.display = 'none';
    } catch (err) {
        console.error('Error opening registration:', err);
        showAlert('❌ Error: ' + err.message, 'danger');
    }
}

async function openVoting(electionId) {
    if (!confirm('Open voting for this election?')) return;
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        if (!token) {
            throw new Error('Authentication required');
        }
        
        const response = await fetch(`${API_BASE}/elections/${electionId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'voting_open' })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to open voting');
        }
        
        showAlert('✅ Voting opened successfully', 'success');
        loadElections();
        document.getElementById('managementModal').style.display = 'none';
    } catch (err) {
        console.error('Error opening voting:', err);
        showAlert('❌ Error: ' + err.message, 'danger');
    }
}

async function closeVoting(electionId) {
    if (!confirm('Close voting for this election?')) return;
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        if (!token) {
            throw new Error('Authentication required');
        }
        
        const response = await fetch(`${API_BASE}/elections/${electionId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'completed' })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to close voting');
        }
        
        showAlert('✅ Voting closed successfully', 'success');
        loadElections();
        document.getElementById('managementModal').style.display = 'none';
    } catch (err) {
        console.error('Error closing voting:', err);
        showAlert('❌ Error: ' + err.message, 'danger');
    }
}

async function publishResults(electionId) {
    if (!confirm('Publish results for this election? This will make results visible to everyone in View Details.')) return;
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        const response = await fetch(`${API_BASE}/elections/${electionId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'results_published' })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to publish results');
        }
        
        showAlert('✅ Results published successfully! Users can now view results in election details.', 'success');
        
        // Reload elections to update status
        loadElections();
        
        // Close management modal after a delay
        setTimeout(() => {
            document.getElementById('managementModal').style.display = 'none';
        }, 1500);
    } catch (err) {
        console.error('Error publishing results:', err);
        showAlert('❌ Error: ' + err.message, 'danger');
    }
}

async function deleteElectionConfirm(electionId) {
    if (!confirm('⚠️ Delete this entire election? This cannot be undone!')) return;
    if (!confirm('Are you absolutely sure? This will delete all candidates and votes.')) return;
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        const response = await fetch(`${API_BASE}/elections/${electionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to delete election');
        showAlert('✅ Election deleted', 'success');
        setTimeout(() => {
            document.getElementById('managementModal').style.display = 'none';
            loadElections();
        }, 1000);
    } catch (err) {
        showAlert('Error: ' + err.message, 'danger');
    }
}

// ==================== VOTER LOGS ====================
async function loadVoterLogs(electionId) {
    const container = document.getElementById('voterLogsContainer');
    const content = document.getElementById('voterLogsContent');
    
    // Toggle visibility
    if (container.style.display === 'block') {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    content.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">Loading voter logs...</p>';
    
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
        
        if (!token) {
            content.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--danger);">Please login to view voter logs</p>';
            return;
        }
        
        const response = await fetch(`${API_BASE}/elections/${electionId}/voter-logs`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to load voter logs');
        }
        
        const logs = data.data || [];
        
        if (logs.length === 0) {
            content.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 48px; margin-bottom: 10px;">📝</div>
                    <div style="color: var(--text-secondary); font-size: 16px;">No votes have been cast yet</div>
                </div>
            `;
            return;
        }
        
        // Group logs by voter and voting session
        const voterSessions = [];
        const voterMap = new Map();
        
        logs.forEach(log => {
            const voterId = log.voter_username;
            if (!voterMap.has(voterId)) {
                voterMap.set(voterId, {
                    voter_name: log.voter_name,
                    voter_username: log.voter_username,
                    first_vote_time: log.voting_time,
                    votes: []
                });
                voterSessions.push(voterMap.get(voterId));
            }
            voterMap.get(voterId).votes.push({
                post_name: log.post_name,
                candidate_name: log.candidate_name,
                voting_time: log.voting_time
            });
        });
        
        // Build HTML
        let html = `
            <div class="voter-logs-summary">
                <div class="summary-stat">
                    <span class="summary-label">Total Voters:</span>
                    <span class="summary-value">${voterSessions.length}</span>
                </div>
                <div class="summary-stat">
                    <span class="summary-label">Total Votes Cast:</span>
                    <span class="summary-value">${logs.length}</span>
                </div>
            </div>
            <div class="voter-logs-list">
        `;
        
        voterSessions.forEach((session, index) => {
            const voteTime = new Date(session.first_vote_time);
            const formattedTime = voteTime.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            
            html += `
                <div class="voter-log-card">
                    <div class="voter-log-header">
                        <div class="voter-log-serial">#${index + 1}</div>
                        <div class="voter-log-info">
                            <div class="voter-log-name">${session.voter_name}</div>
                            <div class="voter-log-meta">@${session.voter_username} • ${formattedTime}</div>
                        </div>
                        <div class="voter-log-count">${session.votes.length} vote${session.votes.length > 1 ? 's' : ''}</div>
                    </div>
                    <div class="voter-log-votes">
            `;
            
            session.votes.forEach(vote => {
                html += `
                    <div class="vote-detail-item">
                        <div class="vote-post-badge">${vote.post_name}</div>
                        <div class="vote-arrow">→</div>
                        <div class="vote-candidate-name">${vote.candidate_name}</div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        content.innerHTML = html;
        
    } catch (err) {
        console.error('Error loading voter logs:', err);
        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 10px;">⚠️</div>
                <div style="color: var(--danger); font-size: 16px; font-weight: 600; margin-bottom: 5px;">Error Loading Voter Logs</div>
                <div style="color: var(--text-secondary); font-size: 14px;">${err.message}</div>
            </div>
        `;
    }
}

// ==================== CREATE ELECTION ====================
function setupCreateElectionModal() {
    const form = document.getElementById('createElectionForm');
    const modal = document.getElementById('createElectionModal');
    
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('electionTitle').value;
        const description = document.getElementById('electionDescription').value;
        const regStart = document.getElementById('regStart').value;
        const regEnd = document.getElementById('regEnd').value;
        const votingStart = document.getElementById('votingStart').value;
        const votingEnd = document.getElementById('votingEnd').value;
        
        if (!selectedPosts.length) {
            showAlert('Please select at least one post', 'danger');
            return;
        }
        
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('Swe_Society_token');
            if (!token) {
                console.error('❌ No token found for election creation');
                showAlert('Authentication required. Please login again.', 'danger');
                return;
            }
            
            console.log('📋 Creating election:', title);
            const response = await fetch(`${API_BASE}/elections`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title,
                    description,
                    registration_start_time: new Date(regStart + 'T00:00:00').toISOString(),
                    registration_end_time: new Date(regEnd + 'T23:59:59').toISOString(),
                    voting_start_time: new Date(votingStart + 'T00:00:00').toISOString(),
                    voting_end_time: new Date(votingEnd + 'T23:59:59').toISOString(),
                    posts: selectedPosts
                })
            });
            
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Failed to create election');
            }
            
            console.log('✅ Election created successfully');
            showAlert('Election created successfully!', 'success');
            setTimeout(() => {
                modal.style.display = 'none';
                form.reset();
                document.getElementById('customPostsContainer').innerHTML = '';
                selectedPosts = [];
                loadElections();
            }, 1000);
        } catch (err) {
            console.error('❌ Error creating election:', err);
            showAlert('❌ ' + (err.message || 'Failed to create election'), 'danger');
        }
    });
}

function populateDefaultPosts() {
    const container = document.getElementById('defaultPostsContainer');
    if (!container) return;
    
    container.innerHTML = defaultPosts.map(post => `
        <div class="post-checkbox">
            <input type="checkbox" id="post_${post.id}" data-id="${post.id}" data-name="${post.name}" checked>
            <label for="post_${post.id}" class="post-label">
                <span class="post-name">${post.name}</span>
                <span class="post-category">${post.category}</span>
            </label>
        </div>
    `).join('');
    
    // Add change event listeners
    container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateSelectedPosts);
    });
    
    // Initialize selected posts with all default posts
    updateSelectedPosts();
}

function updateSelectedPosts() {
    const checkboxes = document.querySelectorAll('#defaultPostsContainer input[type="checkbox"]:checked');
    selectedPosts = Array.from(checkboxes).map(cb => ({
        name: cb.dataset.name,
        default_post_id: cb.dataset.id,
        is_default_post: true,
        post_name: cb.dataset.name
    }));
    
    // Add custom posts
    const customPostInputs = document.querySelectorAll('.custom-post-input');
    for (const input of customPostInputs) {
        if (input.value.trim()) {
            selectedPosts.push({
                name: input.value.trim(),
                post_name: input.value.trim(),
                is_default_post: false
            });
        }
    }
    
    // Update selected posts display
    const selectedList = document.getElementById('selectedPostsList');
    const selectedContent = document.getElementById('selectedPostsContent');
    
    if (selectedPosts.length > 0) {
        selectedList.style.display = 'block';
        selectedContent.innerHTML = selectedPosts.map((post, idx) => `
            <div class="selected-post-tag">
                ${post.post_name}
                ${post.is_default_post ? '' : '<span class="custom-badge">CUSTOM</span>'}
                <button type="button" class="remove-post-btn" data-index="${idx}">×</button>
            </div>
        `).join('');
        
        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-post-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const index = parseInt(btn.dataset.index);
                removePost(index);
            });
        });
    } else {
        selectedList.style.display = 'none';
    }
}

function removePost(index) {
    const post = selectedPosts[index];
    
    if (post.is_default_post) {
        // Uncheck default post checkbox
        const checkbox = document.querySelector(`input[data-id="${post.default_post_id}"]`);
        if (checkbox) {
            checkbox.checked = false;
            updateSelectedPosts();
        }
    } else {
        // Remove custom post input
        const inputs = document.querySelectorAll('.custom-post-input');
        let count = 0;
        for (const input of inputs) {
            if (input.value.trim() === post.post_name) {
                input.parentElement.remove();
                updateSelectedPosts();
                return;
            }
        }
    }
}

function addCustomPost() {
    const container = document.getElementById('customPostsContainer');
    if (!container) {
        console.error('Custom posts container not found');
        return;
    }
    
    const postInput = document.createElement('div');
    postInput.className = 'custom-post-input-group';
    postInput.innerHTML = `
        <input type="text" class="custom-post-input" placeholder="Enter post name (e.g., Social Media Manager)">
        <button type="button" class="btn btn-sm btn-danger remove-input-btn">Remove</button>
    `;
    
    container.appendChild(postInput);
    
    const removeBtn = postInput.querySelector('.remove-input-btn');
    removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        postInput.remove();
        updateSelectedPosts();
    });
    
    const input = postInput.querySelector('.custom-post-input');
    input.addEventListener('change', updateSelectedPosts);
    input.addEventListener('input', updateSelectedPosts);
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            displayElections();
        });
    });
    
    // Create election button
    const createBtn = document.getElementById('createElectionBtn');
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            // Check if user is panel member
            if (!currentUser) {
                showAlert('Please login first', 'danger');
                return;
            }
            
            const isPanelMember = checkPanelMember(currentUser);
            if (!isPanelMember) {
                showAlert('❌ Only panel members can create elections', 'danger');
                return;
            }
            
            populateDefaultPosts();
            document.getElementById('createElectionModal').style.display = 'flex';
        });
    }
    
    // Add custom post button
    const addPostBtn = document.getElementById('addPostBtn');
    if (addPostBtn) {
        addPostBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addCustomPost();
        });
    }
    
    // Modal close buttons
    document.getElementById('closeModal')?.addEventListener('click', () => {
        document.getElementById('createElectionModal').style.display = 'none';
        document.getElementById('createElectionForm').reset();
        document.getElementById('customPostsContainer').innerHTML = '';
        selectedPosts = [];
    });
    
    document.getElementById('closeDetailsModal')?.addEventListener('click', () => {
        document.getElementById('electionDetailsModal').style.display = 'none';
    });
    
    document.getElementById('closeRegisterModal')?.addEventListener('click', () => {
        document.getElementById('registerCandidateModal').style.display = 'none';
        document.getElementById('registerCandidateForm').reset();
    });
    
    document.getElementById('closeVoteModal')?.addEventListener('click', () => {
        document.getElementById('voteModal').style.display = 'none';
    });
    
    document.getElementById('cancelBtn')?.addEventListener('click', () => {
        document.getElementById('createElectionModal').style.display = 'none';
        document.getElementById('customPostsContainer').innerHTML = '';
    });
    
    document.getElementById('cancelRegisterBtn')?.addEventListener('click', () => {
        document.getElementById('registerCandidateModal').style.display = 'none';
    });
    
    // Modal overlays
    document.getElementById('modalOverlay')?.addEventListener('click', () => {
        document.getElementById('createElectionModal').style.display = 'none';
    });
    
    document.getElementById('detailsModalOverlay')?.addEventListener('click', () => {
        document.getElementById('electionDetailsModal').style.display = 'none';
    });
    
    document.getElementById('registerModalOverlay')?.addEventListener('click', () => {
        document.getElementById('registerCandidateModal').style.display = 'none';
    });
    
    document.getElementById('voteModalOverlay')?.addEventListener('click', () => {
        document.getElementById('voteModal').style.display = 'none';
    });
    
    document.getElementById('closeManagementModal')?.addEventListener('click', () => {
        document.getElementById('managementModal').style.display = 'none';
    });
    
    document.getElementById('managementModalOverlay')?.addEventListener('click', () => {
        document.getElementById('managementModal').style.display = 'none';
    });
    
    // Setup create election form
    setupCreateElectionModal();
    
    // Setup edit election form
    setupEditElectionModal();
}

// ==================== EDIT ELECTION ====================

// Open Edit Election Modal
async function openEditElection(electionId) {
    try {
        const token = localStorage.getItem('Swe_Society_token') || localStorage.getItem('token');
        if (!token) {
            showAlert('Please login to edit election', 'danger');
            return;
        }

        // Fetch election details
        const response = await fetch(`${API_BASE}/elections/${electionId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch election details');
        }

        const data = await response.json();
        const election = data.data; // API returns { success: true, data: election }

        if (!election) {
            throw new Error('Election data not found');
        }

        // Populate form fields
        document.getElementById('editElectionId').value = election.id;
        document.getElementById('editElectionTitle').value = election.title || '';
        document.getElementById('editElectionDescription').value = election.description || '';
        
        // Format dates for input fields (YYYY-MM-DD) - use correct field names
        document.getElementById('editRegStart').value = formatDateForInput(election.registration_start_date);
        document.getElementById('editRegEnd').value = formatDateForInput(election.registration_end_date);
        document.getElementById('editVotingStart').value = formatDateForInput(election.voting_start_date);
        document.getElementById('editVotingEnd').value = formatDateForInput(election.voting_end_date);

        // Load posts
        const postsContainer = document.getElementById('editPostsContainer');
        const currentPosts = election.posts || [];
        
        postsContainer.innerHTML = `
            <div class="posts-section">
                <label><input type="checkbox" class="edit-post-checkbox" value="President" ${currentPosts.some(p => p.post_name === 'President') ? 'checked' : ''}> President</label>
                <label><input type="checkbox" class="edit-post-checkbox" value="Vice President" ${currentPosts.some(p => p.post_name === 'Vice President') ? 'checked' : ''}> Vice President</label>
                <label><input type="checkbox" class="edit-post-checkbox" value="Secretary" ${currentPosts.some(p => p.post_name === 'Secretary') ? 'checked' : ''}> Secretary</label>
                <label><input type="checkbox" class="edit-post-checkbox" value="Treasurer" ${currentPosts.some(p => p.post_name === 'Treasurer') ? 'checked' : ''}> Treasurer</label>
                <label><input type="checkbox" class="edit-post-checkbox" value="Joint Secretary" ${currentPosts.some(p => p.post_name === 'Joint Secretary') ? 'checked' : ''}> Joint Secretary</label>
                <label><input type="checkbox" class="edit-post-checkbox" value="Executive Member" ${currentPosts.some(p => p.post_name === 'Executive Member') ? 'checked' : ''}> Executive Member</label>
            </div>
            <div class="custom-posts-section" style="margin-top: 10px;">
                <label>Custom Posts (comma-separated):</label>
                <input type="text" id="editCustomPosts" class="form-control" placeholder="e.g., Cultural Secretary, Sports Secretary" 
                       value="${currentPosts.filter(p => !['President', 'Vice President', 'Secretary', 'Treasurer', 'Joint Secretary', 'Executive Member'].includes(p.post_name)).map(p => p.post_name).join(', ')}">
            </div>
        `;

        // Clear any previous alert
        const alert = document.getElementById('editFormAlert');
        alert.style.display = 'none';

        // Show modal
        document.getElementById('editElectionModal').style.display = 'flex';

    } catch (error) {
        console.error('Error loading election for edit:', error);
        showAlert('Failed to load election details: ' + error.message, 'danger');
    }
}

// Format date for input field
function formatDateForInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Close Edit Election Modal
function closeEditElectionModal() {
    document.getElementById('editElectionModal').style.display = 'none';
    document.getElementById('editElectionForm').reset();
}

// Save Election Changes
async function saveElectionChanges(event) {
    event.preventDefault();
    
    const token = localStorage.getItem('Swe_Society_token') || localStorage.getItem('token');
    if (!token) {
        showAlert('Please login to edit election', 'danger');
        return;
    }

    const electionId = document.getElementById('editElectionId').value;
    const alertDiv = document.getElementById('editFormAlert');

    // Gather form data
    const title = document.getElementById('editElectionTitle').value.trim();
    const description = document.getElementById('editElectionDescription').value.trim();
    const registrationStart = document.getElementById('editRegStart').value;
    const registrationEnd = document.getElementById('editRegEnd').value;
    const votingStart = document.getElementById('editVotingStart').value;
    const votingEnd = document.getElementById('editVotingEnd').value;

    // Validate required fields
    if (!title || !registrationStart || !registrationEnd || !votingStart || !votingEnd) {
        alertDiv.textContent = 'Please fill in all required fields';
        alertDiv.className = 'alert alert-danger';
        alertDiv.style.display = 'block';
        return;
    }

    // Validate dates
    if (new Date(registrationEnd) < new Date(registrationStart)) {
        alertDiv.textContent = 'Registration end date must be after start date';
        alertDiv.className = 'alert alert-danger';
        alertDiv.style.display = 'block';
        return;
    }

    if (new Date(votingStart) < new Date(registrationEnd)) {
        alertDiv.textContent = 'Voting start must be after registration end';
        alertDiv.className = 'alert alert-danger';
        alertDiv.style.display = 'block';
        return;
    }

    if (new Date(votingEnd) < new Date(votingStart)) {
        alertDiv.textContent = 'Voting end date must be after start date';
        alertDiv.className = 'alert alert-danger';
        alertDiv.style.display = 'block';
        return;
    }

    // Gather posts
    const selectedPosts = [];
    document.querySelectorAll('.edit-post-checkbox:checked').forEach(cb => {
        selectedPosts.push(cb.value);
    });
    
    // Add custom posts
    const customPostsInput = document.getElementById('editCustomPosts').value.trim();
    if (customPostsInput) {
        const customPosts = customPostsInput.split(',').map(p => p.trim()).filter(p => p);
        selectedPosts.push(...customPosts);
    }

    if (selectedPosts.length === 0) {
        alertDiv.textContent = 'Please select at least one post';
        alertDiv.className = 'alert alert-danger';
        alertDiv.style.display = 'block';
        return;
    }

    try {
        alertDiv.textContent = 'Saving changes...';
        alertDiv.className = 'alert alert-info';
        alertDiv.style.display = 'block';

        const response = await fetch(`${API_BASE}/elections/${electionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title,
                description,
                registration_start_time: registrationStart,
                registration_end_time: registrationEnd,
                voting_start_time: votingStart,
                voting_end_time: votingEnd,
                posts: selectedPosts
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to update election');
        }

        alertDiv.textContent = 'Election updated successfully!';
        alertDiv.className = 'alert alert-success';
        
        setTimeout(() => {
            closeEditElectionModal();
            loadElections(); // Refresh the elections list
            showAlert('Election updated successfully!', 'success');
        }, 1000);

    } catch (error) {
        console.error('Error updating election:', error);
        alertDiv.textContent = error.message || 'Failed to update election';
        alertDiv.className = 'alert alert-danger';
        alertDiv.style.display = 'block';
    }
}

// Setup Edit Election Modal Events
function setupEditElectionModal() {
    // Close button
    const closeBtn = document.getElementById('closeEditModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeEditElectionModal);
    }

    // Cancel button
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeEditElectionModal);
    }

    // Overlay click
    const overlay = document.getElementById('editModalOverlay');
    if (overlay) {
        overlay.addEventListener('click', closeEditElectionModal);
    }

    // Form submit
    const form = document.getElementById('editElectionForm');
    if (form) {
        form.addEventListener('submit', saveElectionChanges);
    }
}

// ==================== UTILITIES ====================
function showAlert(message, type = 'danger') {
    // Create temporary alert
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    alert.style.position = 'fixed';
    alert.style.top = '20px';
    alert.style.right = '20px';
    alert.style.zIndex = '9999';
    alert.style.maxWidth = '450px';
    alert.style.minWidth = '320px';
    alert.style.cursor = 'pointer';
    
    document.body.appendChild(alert);
    
    // Click to close
    alert.addEventListener('click', () => {
        alert.classList.add('exit');
        setTimeout(() => alert.remove(), 400);
    });
    
    // Auto dismiss after 4 seconds
    setTimeout(() => {
        if (document.body.contains(alert)) {
            alert.classList.add('exit');
            setTimeout(() => {
                if (document.body.contains(alert)) {
                    alert.remove();
                }
            }, 400);
        }
    }, 4000);
}
