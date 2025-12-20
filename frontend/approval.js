// ==================== APPROVAL FEATURE ====================

// Make sure approvalManager is globally accessible
let approvalManager;

class ApprovalManager {
    constructor(apiBase) {
        this.apiBase = apiBase;
        this.currentUser = null;
        this.approvals = [];
        this.selectedApproval = null;
    }

    // Initialize
    async init() {
        console.log('[ApprovalManager] Initializing...');
        try {
            this.currentUser = JSON.parse(localStorage.getItem('Swe_Society_user'));
            console.log('[ApprovalManager] Current user:', this.currentUser);
            
            if (!this.currentUser) {
                console.warn('[ApprovalManager] No user found in localStorage');
            }
            
            this.setupEventListeners();
            console.log('[ApprovalManager] Event listeners set up');
            console.log('[ApprovalManager] Initialization complete. approvalManager is ready.');
        } catch (error) {
            console.error('[ApprovalManager] Initialization error:', error);
            throw error;
        }
        // Don't auto-load - will be triggered when tab is activated
    }

    // Load all approvals
    async loadApprovals() {
        const loadingEl = document.getElementById('approvalsLoading');
        const listEl = document.getElementById('approvalsList');
        
        console.log('[ApprovalManager] loadApprovals called');
        console.log('[ApprovalManager] Loading element:', loadingEl);
        console.log('[ApprovalManager] List element:', listEl);
        
        try {
            // Show loading state
            if (loadingEl) loadingEl.style.display = 'block';
            if (listEl) listEl.style.display = 'none';

            if (!window.authManager) {
                console.error('[ApprovalManager] Auth manager not available');
                throw new Error('Authentication system not ready. Please refresh the page.');
            }

            console.log('[ApprovalManager] Fetching approvals from:', `${this.apiBase}/approvals/list?status=all&filterType=all`);
            
            const response = await window.authManager.authenticatedFetch(
                `${this.apiBase}/approvals/list?status=all&filterType=all`
            );
            
            console.log('[ApprovalManager] Response status:', response.status);
            console.log('[ApprovalManager] Response OK:', response.ok);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[ApprovalManager] Error response:', errorText);
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('[ApprovalManager] API result:', result);
            
            if (result.success) {
                this.approvals = result.data;
                console.log('[ApprovalManager] Loaded approvals:', this.approvals.length);
                this.renderApprovalsList();
            } else {
                throw new Error(result.message || 'Failed to load approvals');
            }
        } catch (error) {
            console.error('[ApprovalManager] Error loading approvals:', error);
            this.showError(error.message || 'Failed to load approvals');
            
            // Show error in list
            if (listEl) {
                listEl.innerHTML = `
                    <div class="empty-state">
                        <p style="color: #dc2626;">Failed to load approval requests</p>
                        <p>${this.escapeHtml(error.message)}</p>
                        <button class="btn btn-secondary" onclick="approvalManager.loadApprovals()">Retry</button>
                    </div>
                `;
                listEl.style.display = 'block';
            }
        } finally {
            // Hide loading state
            if (loadingEl) loadingEl.style.display = 'none';
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Create new approval button
        const createApprovalBtn = document.getElementById('createApprovalBtn');
        if (createApprovalBtn) {
            createApprovalBtn.addEventListener('click', () => this.showCreateModal());
        }

        // Modal close buttons
        const closeModals = document.querySelectorAll('[class*="closeApprovalModal"]');
        closeModals.forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        // Filter buttons
        const filterBtns = document.querySelectorAll('[class*="approval-filter"]');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.filterApprovals(e.target.dataset.filter));
        });
    }

    // Render approvals list
    renderApprovalsList() {
        const container = document.getElementById('approvalsList');
        console.log('[ApprovalManager] renderApprovalsList - container:', container);
        console.log('[ApprovalManager] renderApprovalsList - approvals count:', this.approvals.length);
        
        if (!container) {
            console.error('[ApprovalManager] approvalsList container not found!');
            return;
        }

        if (this.approvals.length === 0) {
            container.innerHTML = '<div class="empty-state">No approval requests found</div>';
            container.style.display = 'block';
            return;
        }

        try {
            container.innerHTML = this.approvals.map(approval => `
                <div class="approval-card" data-id="${approval.id}">
                    <div class="approval-header">
                        <div class="approval-title">
                            <h3>${this.escapeHtml(approval.title)}</h3>
                            <span class="status-badge status-${approval.status}">${approval.status}</span>
                        </div>
                        <div class="approval-deadline">
                            ${approval.deadline ? `<span class="deadline">Due: ${new Date(approval.deadline).toLocaleDateString()}</span>` : ''}
                        </div>
                    </div>

                    <div class="approval-description">
                        <p>${this.escapeHtml(approval.description || 'No description')}</p>
                    </div>

                    <div class="approval-creator">
                        <small>Created by <strong>${this.escapeHtml(approval.creator_name)}</strong></small>
                    </div>

                    <div class="approval-stats">
                        <div class="stat">
                            <span class="stat-label">Total Recipients:</span>
                            <span class="stat-value">${approval.recipients.total}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">✓ Approved:</span>
                            <span class="stat-value approved">${approval.recipients.approved}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">✗ Rejected:</span>
                            <span class="stat-value rejected">${approval.recipients.rejected}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">⏳ Pending:</span>
                            <span class="stat-value pending">${approval.recipients.pending}</span>
                        </div>
                    </div>

                    <div class="approval-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(approval.recipients.approved / approval.recipients.total * 100) || 0}%"></div>
                        </div>
                        <small>${approval.recipients.total > 0 ? Math.round((approval.recipients.approved / approval.recipients.total) * 100) : 0}% Approved</small>
                    </div>

                    <div class="approval-actions">
                        <button class="btn-small btn-view" onclick="approvalManager.showDetails(${approval.id})">View Details</button>
                        ${this.currentUser && this.currentUser.userId === approval.creator_id ? `
                            <button class="btn-small btn-edit" onclick="approvalManager.showEditModal(${approval.id})">Edit</button>
                            <button class="btn-small btn-delete" onclick="approvalManager.deleteApproval(${approval.id})">Delete</button>
                            ${approval.status === 'active' ? `<button class="btn-small btn-complete" onclick="approvalManager.completeApproval(${approval.id})">Mark Complete</button>` : ''}
                        ` : ''}
                    </div>
                </div>
            `).join('');
            
            container.style.display = 'block';

            // Update count
            const countElement = document.getElementById('approvalsCount');
            if (countElement) {
                countElement.textContent = this.approvals.length;
            }
            
            console.log('[ApprovalManager] Rendered', this.approvals.length, 'approval cards');
        } catch (error) {
            console.error('[ApprovalManager] Error rendering approvals:', error);
            container.innerHTML = `<div class="empty-state" style="color: #dc2626;">Error rendering approvals: ${this.escapeHtml(error.message)}</div>`;
            container.style.display = 'block';
        }
    }

    // Show approval details modal
    async showDetails(id) {
        try {
            if (!window.authManager) {
                this.showError('Authentication system not ready');
                return;
            }

            const response = await window.authManager.authenticatedFetch(
                `${this.apiBase}/approvals/${id}`
            );
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                const data = result.data;
                const modal = document.getElementById('approvalDetailsModal');
                
                modal.innerHTML = `
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2>${this.escapeHtml(data.title)}</h2>
                            <button class="closeApprovalModal" onclick="document.getElementById('approvalDetailsModal').style.display='none'">&times;</button>
                        </div>

                        <div class="modal-body">
                            <div class="approval-detail-section">
                                <h4>Description</h4>
                                <p>${this.escapeHtml(data.description || 'No description')}</p>
                            </div>

                            <div class="approval-detail-section">
                                <h4>Status</h4>
                                <p><span class="status-badge status-${data.status}">${data.status}</span></p>
                            </div>

                            <div class="approval-detail-section">
                                <h4>Timeline</h4>
                                <p>Created: ${new Date(data.created_at).toLocaleString()}</p>
                                ${data.deadline ? `<p>Deadline: ${new Date(data.deadline).toLocaleString()}</p>` : ''}
                                ${data.completed_at ? `<p>Completed: ${new Date(data.completed_at).toLocaleString()}</p>` : ''}
                            </div>

                            <div class="approval-detail-section">
                                <h4>Statistics</h4>
                                <div class="stats-grid">
                                    <div class="stat-box">
                                        <span class="label">Total Recipients</span>
                                        <span class="value">${data.stats.total}</span>
                                    </div>
                                    <div class="stat-box approved">
                                        <span class="label">Approved</span>
                                        <span class="value">${data.stats.approved}</span>
                                    </div>
                                    <div class="stat-box rejected">
                                        <span class="label">Rejected</span>
                                        <span class="value">${data.stats.rejected}</span>
                                    </div>
                                    <div class="stat-box pending">
                                        <span class="label">Pending</span>
                                        <span class="value">${data.stats.pending}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="approval-detail-section">
                                <h4>Recipients & Responses</h4>
                                <div class="recipients-list">
                                    ${data.recipients.map(r => `
                                        <div class="recipient-item status-${r.status}">
                                            <div class="recipient-info">
                                                <span class="recipient-name">${this.escapeHtml(r.name)}</span>
                                                <small class="recipient-email">${this.escapeHtml(r.email)}</small>
                                            </div>
                                            <div class="recipient-status">
                                                <span class="status-badge status-${r.status}">${r.status}</span>
                                                ${r.response_at ? `<small>${new Date(r.response_at).toLocaleString()}</small>` : ''}
                                            </div>
                                            ${r.response_notes ? `<div class="recipient-notes">${this.escapeHtml(r.response_notes)}</div>` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                         ${this.currentUser && this.currentUser.userId !== data.creator_id ? `
                             <div class="approval-detail-section">
                                 <h4>Your Response</h4>
                                 ${data.recipients.some(r => r.user_id === this.currentUser.userId && r.status === 'pending') ? `
                                     <div class="response-form">
                                         <textarea id="responseNotes" placeholder="Add notes (optional)"></textarea>
                                         <div class="button-group">
                                             <button class="btn btn-success" onclick="approvalManager.submitResponse(${id}, 'approved')">
                                                 ✓ Approve
                                             </button>
                                             <button class="btn btn-danger" onclick="approvalManager.submitResponse(${id}, 'rejected')">
                                                 ✗ Reject
                                             </button>
                                         </div>
                                     </div>
                                 ` : data.recipients.find(r => r.user_id === this.currentUser.userId) ? `
                                     <p class="your-response">
                                         Your response: <strong>${data.recipients.find(r => r.user_id === this.currentUser.userId).status}</strong>
                                     </p>
                                 ` : ''}
                             </div>
                         ` : ''}
                        </div>

                        <div class="modal-footer">
                            <button class="btn btn-secondary" onclick="document.getElementById('approvalDetailsModal').style.display='none'">Close</button>
                        </div>
                    </div>
                `;

                modal.style.display = 'block';
            }
        } catch (error) {
            console.error('Error loading approval details:', error);
            this.showError('Failed to load approval details');
        }
    }

    // Show create modal
    showCreateModal() {
        const modal = document.getElementById('createApprovalModal');
        if (!modal) return;

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Create Approval Request</h2>
                    <button class="closeApprovalModal" onclick="this.closest('.modal-content').parentElement.style.display='none'">&times;</button>
                </div>

                <div class="modal-body">
                    <div id="createApprovalError" class="alert alert-error" style="display: none;"></div>
                    <form id="createApprovalForm">
                        <div class="form-group">
                            <label for="approvalTitle">Title *</label>
                            <input type="text" id="approvalTitle" required maxlength="255" placeholder="Enter approval request title">
                            <small style="color: #6b7280;">Max 255 characters</small>
                        </div>

                        <div class="form-group">
                            <label for="approvalDescription">Description</label>
                            <textarea id="approvalDescription" rows="4" maxlength="2000" placeholder="Enter approval request description"></textarea>
                            <small style="color: #6b7280;">Optional, max 2000 characters</small>
                        </div>

                        <div class="form-group">
                            <label for="approvalDeadline">Deadline</label>
                            <input type="datetime-local" id="approvalDeadline">
                            <small style="color: #6b7280;">Optional</small>
                        </div>

                        <div class="form-group">
                            <label for="recipientSelect">Select Recipients * (Hold Ctrl/Cmd for multiple)</label>
                            <div id="recipientLoadingState" style="padding: 20px; text-align: center; color: #6b7280;">
                                Loading users...
                            </div>
                            <select id="recipientSelect" multiple required size="8" style="display: none;"></select>
                            <small>Selected: <span id="selectedCount">0</span> users</small>
                        </div>

                        <div class="button-group">
                            <button type="submit" class="btn btn-primary" id="createApprovalSubmitBtn">
                                <span class="btn-text">Create Request</span>
                                <span class="spinner" style="display: none;"></span>
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-content').parentElement.style.display='none'">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Load users for recipient selection
        this.loadUsersForSelection();

        const recipientSelect = document.getElementById('recipientSelect');
        if (recipientSelect) {
            recipientSelect.addEventListener('change', () => {
                const selectedCount = document.getElementById('selectedCount');
                if (selectedCount) {
                    selectedCount.textContent = recipientSelect.selectedOptions.length;
                }
            });
        }

        const form = document.getElementById('createApprovalForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createApproval();
            });
        }

        modal.style.display = 'block';
    }

    // Load users for recipient selection
    async loadUsersForSelection() {
        const loadingState = document.getElementById('recipientLoadingState');
        const select = document.getElementById('recipientSelect');
        
        try {
            // Ensure currentUser is loaded
            if (!this.currentUser) {
                this.currentUser = JSON.parse(localStorage.getItem('Swe_Society_user'));
            }

            if (!window.authManager) {
                throw new Error('Authentication system not ready');
            }

            const response = await window.authManager.authenticatedFetch(
                `${this.apiBase}/profile/users/all`
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success && result.data) {
                if (!select) {
                    console.error('recipient select element not found');
                    return;
                }
                
                const currentUserId = this.currentUser?.id;
                const users = result.data.filter(u => u.id !== currentUserId);
                
                if (users.length === 0) {
                    select.innerHTML = '<option disabled>No other users available</option>';
                } else {
                    select.innerHTML = users
                        .map(u => `<option value="${u.id}">${this.escapeHtml(u.name)} (@${this.escapeHtml(u.username)})</option>`)
                        .join('');
                }
                
                // Show select, hide loading
                if (loadingState) loadingState.style.display = 'none';
                select.style.display = 'block';
            } else {
                throw new Error(result.message || 'Failed to load users');
            }
        } catch (error) {
            console.error('Error loading users:', error);
            
            // Show error in the modal
            if (loadingState) {
                loadingState.innerHTML = `
                    <p style="color: #dc2626;">Failed to load users</p>
                    <button class="btn btn-secondary btn-sm" onclick="approvalManager.loadUsersForSelection()">Retry</button>
                `;
            }
            
            this.showModalError(error.message || 'Failed to load users for recipient selection');
        }
    }

    // Create approval
    async createApproval() {
        const submitBtn = document.getElementById('createApprovalSubmitBtn');
        const btnText = submitBtn?.querySelector('.btn-text');
        const spinner = submitBtn?.querySelector('.spinner');
        
        try {
            // Show loading state
            if (submitBtn) submitBtn.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (spinner) spinner.style.display = 'inline-block';
            
            // Clear previous errors
            this.hideModalError();

            const title = document.getElementById('approvalTitle')?.value?.trim();
            const description = document.getElementById('approvalDescription')?.value?.trim();
            const deadline = document.getElementById('approvalDeadline')?.value;
            const recipientSelect = document.getElementById('recipientSelect');
            
            // Input validation
            if (!title) {
                throw new Error('Title is required');
            }

            if (title.length > 255) {
                throw new Error('Title is too long (max 255 characters)');
            }

            if (description && description.length > 2000) {
                throw new Error('Description is too long (max 2000 characters)');
            }

            if (!recipientSelect || recipientSelect.selectedOptions.length === 0) {
                throw new Error('At least one recipient is required');
            }

            const recipientIds = Array.from(recipientSelect.selectedOptions)
                .map(option => parseInt(option.value))
                .filter(id => !isNaN(id) && id > 0);

            if (recipientIds.length === 0) {
                throw new Error('Please select valid recipients');
            }

            // Validate deadline if provided
            if (deadline) {
                const deadlineDate = new Date(deadline);
                if (isNaN(deadlineDate.getTime())) {
                    throw new Error('Invalid deadline format');
                }
                if (deadlineDate < new Date()) {
                    throw new Error('Deadline must be in the future');
                }
            }

            if (!window.authManager) {
                throw new Error('Authentication system not ready');
            }

            // Prepare request body
            const requestBody = {
                title,
                description: description || null,
                deadline: deadline || null,
                recipientIds
            };

            const response = await window.authManager.authenticatedFetch(
                `${this.apiBase}/approvals/create`,
                {
                    method: 'POST',
                    body: JSON.stringify(requestBody)
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                this.showSuccess('Approval request created successfully');
                document.getElementById('createApprovalModal').style.display = 'none';
                await this.loadApprovals();
            } else {
                throw new Error(result.message || 'Failed to create approval request');
            }
        } catch (error) {
            console.error('Error creating approval:', error);
            this.showModalError(error.message || 'Failed to create approval request');
        } finally {
            // Reset button state
            if (submitBtn) submitBtn.disabled = false;
            if (btnText) btnText.style.display = 'inline';
            if (spinner) spinner.style.display = 'none';
        }
    }

    // Submit response
    async submitResponse(id, status) {
        try {
            // Validate inputs
            if (!id || !status) {
                this.showError('Invalid request parameters');
                return;
            }

            if (!['approved', 'rejected'].includes(status)) {
                this.showError('Invalid status');
                return;
            }

            if (!window.authManager) {
                this.showError('Authentication system not ready');
                return;
            }

            const notes = document.getElementById('responseNotes')?.value?.trim() || '';

            const response = await window.authManager.authenticatedFetch(
                `${this.apiBase}/approvals/${id}/respond`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        approvalStatus: status,
                        notes: notes || null
                    })
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                this.showSuccess(`Request ${status} successfully`);
                document.getElementById('approvalDetailsModal').style.display = 'none';
                await this.loadApprovals();
            } else {
                throw new Error(result.message || 'Failed to submit response');
            }
        } catch (error) {
            console.error('Error submitting response:', error);
            this.showError('Failed to submit response');
        }
    }

    // Delete approval
    async deleteApproval(id) {
        if (!confirm('Are you sure you want to delete this approval request?')) return;

        try {
            if (!id) {
                this.showError('Invalid approval ID');
                return;
            }

            if (!window.authManager) {
                this.showError('Authentication system not ready');
                return;
            }

            const response = await window.authManager.authenticatedFetch(
                `${this.apiBase}/approvals/${id}/delete`,
                { method: 'DELETE' }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                this.showSuccess('Approval request deleted successfully');
                await this.loadApprovals();
            } else {
                throw new Error(result.message || 'Failed to delete approval request');
            }
        } catch (error) {
            console.error('Error deleting approval:', error);
            this.showError('Failed to delete approval request');
        }
    }

    // Complete approval
    async completeApproval(id) {
        if (!confirm('Mark this approval request as completed?')) return;

        try {
            if (!id) {
                this.showError('Invalid approval ID');
                return;
            }

            if (!window.authManager) {
                this.showError('Authentication system not ready');
                return;
            }

            const response = await window.authManager.authenticatedFetch(
                `${this.apiBase}/approvals/${id}/complete`,
                { method: 'POST' }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                this.showSuccess('Approval request completed successfully');
                await this.loadApprovals();
            } else {
                throw new Error(result.message || 'Failed to complete approval request');
            }
        } catch (error) {
            console.error('Error completing approval:', error);
            this.showError('Failed to complete approval request');
        }
    }

    // Filter approvals
    filterApprovals(type) {
        // Filter logic
        const filtered = this.approvals.filter(a => {
            if (type === 'created') return a.creator_id === this.currentUser?.userId;
            if (type === 'active') return a.status === 'active';
            if (type === 'completed') return a.status === 'completed';
            return true;
        });

        // Temporarily replace approvals for rendering
        const temp = this.approvals;
        this.approvals = filtered;
        this.renderApprovalsList();
        this.approvals = temp;
    }

    // Show edit modal
    async showEditModal(id) {
        try {
            console.log('[ApprovalManager] showEditModal called with id:', id);

            // Fetch current approval data
            if (!window.authManager) {
                this.showError('Authentication system not ready');
                return;
            }

            const response = await window.authManager.authenticatedFetch(
                `${this.apiBase}/approvals/${id}`
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Failed to load approval details');
            }

            const approval = result.data;

            // Verify ownership
            if (!this.currentUser || this.currentUser.userId !== approval.creator_id) {
                this.showError('You can only edit your own approval requests');
                return;
            }

            // Check if approval can be edited (only active ones)
            if (approval.status !== 'active') {
                this.showError('Only active approval requests can be edited');
                return;
            }

            this.showEditModalUI(approval);

        } catch (error) {
            console.error('[ApprovalManager] Error loading approval for edit:', error);
            this.showError('Failed to load approval details for editing');
        }
    }

    // Show edit modal UI
    showEditModalUI(approval) {
        const modal = document.getElementById('editApprovalModal');
        if (!modal) {
            console.error('Edit modal element not found');
            this.showError('Edit modal not available');
            return;
        }

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Edit Approval Request</h2>
                    <button class="closeApprovalModal" onclick="document.getElementById('editApprovalModal').style.display='none'">&times;</button>
                </div>

                <div class="modal-body">
                    <div id="editApprovalError" class="alert alert-error" style="display: none;"></div>
                    <form id="editApprovalForm">
                        <div class="form-group">
                            <label for="editApprovalTitle">Title *</label>
                            <input type="text" id="editApprovalTitle" required maxlength="255" placeholder="Enter approval request title" value="${this.escapeHtml(approval.title)}">
                            <small style="color: #6b7280;">Max 255 characters</small>
                        </div>

                        <div class="form-group">
                            <label for="editApprovalDescription">Description</label>
                            <textarea id="editApprovalDescription" rows="4" maxlength="2000" placeholder="Enter approval request description">${this.escapeHtml(approval.description || '')}</textarea>
                            <small style="color: #6b7280;">Optional, max 2000 characters</small>
                        </div>

                        <div class="form-group">
                            <label for="editApprovalDeadline">Deadline</label>
                            <input type="datetime-local" id="editApprovalDeadline" value="${approval.deadline ? new Date(approval.deadline).toISOString().slice(0, 16) : ''}">
                            <small style="color: #6b7280;">Optional</small>
                        </div>

                        <div class="form-group">
                            <label for="editRecipientSelect">Select Recipients * (Hold Ctrl/Cmd for multiple)</label>
                            <div id="editRecipientLoadingState" style="padding: 20px; text-align: center; color: #6b7280;">
                                Loading users...
                            </div>
                            <select id="editRecipientSelect" multiple required size="8" style="display: none;"></select>
                            <small>Selected: <span id="editSelectedCount">0</span> users</small>
                        </div>

                        <div class="button-group">
                            <button type="submit" class="btn btn-primary" id="editApprovalSubmitBtn">
                                <span class="btn-text">Update Request</span>
                                <span class="spinner" style="display: none;"></span>
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="document.getElementById('editApprovalModal').style.display='none'">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Load users for recipient selection
        this.loadUsersForEditSelection(approval.recipients);

        const form = document.getElementById('editApprovalForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.updateApproval(approval.id);
            });
        }

        modal.style.display = 'block';
    }

    // Load users for edit recipient selection
    async loadUsersForEditSelection(currentRecipients) {
        const loadingState = document.getElementById('editRecipientLoadingState');
        const select = document.getElementById('editRecipientSelect');

        try {
            // Ensure currentUser is loaded
            if (!this.currentUser) {
                this.currentUser = JSON.parse(localStorage.getItem('Swe_Society_user'));
            }

            if (!window.authManager) {
                throw new Error('Authentication system not ready');
            }

            const response = await window.authManager.authenticatedFetch(
                `${this.apiBase}/profile/users/all`
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success && result.data) {
                if (!select) {
                    console.error('edit recipient select element not found');
                    return;
                }

                const currentUserId = this.currentUser?.id;
                const users = result.data.filter(u => u.id !== currentUserId);

                if (users.length === 0) {
                    select.innerHTML = '<option disabled>No other users available</option>';
                } else {
                    // Get current recipient IDs
                    const currentRecipientIds = currentRecipients.map(r => r.user_id);

                    select.innerHTML = users
                        .map(u => `<option value="${u.id}" ${currentRecipientIds.includes(u.id) ? 'selected' : ''}>${this.escapeHtml(u.name)} (@${this.escapeHtml(u.username)})</option>`)
                        .join('');
                }

                // Update selected count
                this.updateEditSelectedCount();

                // Show select, hide loading
                if (loadingState) loadingState.style.display = 'none';
                select.style.display = 'block';

                // Add change listener
                select.addEventListener('change', () => {
                    this.updateEditSelectedCount();
                });
            } else {
                throw new Error(result.message || 'Failed to load users');
            }
        } catch (error) {
            console.error('Error loading users for edit:', error);

            // Show error in the modal
            if (loadingState) {
                loadingState.innerHTML = `
                    <p style="color: #dc2626;">Failed to load users</p>
                    <button class="btn btn-secondary btn-sm" onclick="approvalManager.loadUsersForEditSelection(${JSON.stringify(currentRecipients)})">Retry</button>
                `;
            }

            this.showEditModalError(error.message || 'Failed to load users for recipient selection');
        }
    }

    // Update selected count for edit modal
    updateEditSelectedCount() {
        const select = document.getElementById('editRecipientSelect');
        const selectedCount = document.getElementById('editSelectedCount');

        if (select && selectedCount) {
            selectedCount.textContent = select.selectedOptions.length;
        }
    }

    // Update approval
    async updateApproval(id) {
        const submitBtn = document.getElementById('editApprovalSubmitBtn');
        const btnText = submitBtn?.querySelector('.btn-text');
        const spinner = submitBtn?.querySelector('.spinner');

        try {
            // Show loading state
            if (submitBtn) submitBtn.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (spinner) spinner.style.display = 'inline-block';

            // Clear previous errors
            this.hideEditModalError();

            const title = document.getElementById('editApprovalTitle')?.value?.trim();
            const description = document.getElementById('editApprovalDescription')?.value?.trim();
            const deadline = document.getElementById('editApprovalDeadline')?.value;
            const recipientSelect = document.getElementById('editRecipientSelect');

            // Input validation
            if (!title) {
                throw new Error('Title is required');
            }

            if (title.length > 255) {
                throw new Error('Title is too long (max 255 characters)');
            }

            if (description && description.length > 2000) {
                throw new Error('Description is too long (max 2000 characters)');
            }

            if (!recipientSelect || recipientSelect.selectedOptions.length === 0) {
                throw new Error('At least one recipient is required');
            }

            const recipientIds = Array.from(recipientSelect.selectedOptions)
                .map(option => parseInt(option.value))
                .filter(id => !isNaN(id) && id > 0);

            if (recipientIds.length === 0) {
                throw new Error('Please select valid recipients');
            }

            // Validate deadline if provided
            if (deadline) {
                const deadlineDate = new Date(deadline);
                if (isNaN(deadlineDate.getTime())) {
                    throw new Error('Invalid deadline format');
                }
                if (deadlineDate < new Date()) {
                    throw new Error('Deadline must be in the future');
                }
            }

            if (!window.authManager) {
                throw new Error('Authentication system not ready');
            }

            // Prepare request body
            const requestBody = {
                title,
                description: description || null,
                deadline: deadline || null,
                recipientIds
            };

            const response = await window.authManager.authenticatedFetch(
                `${this.apiBase}/approvals/${id}/update`,
                {
                    method: 'PUT',
                    body: JSON.stringify(requestBody)
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                this.showSuccess('Approval request updated successfully');
                document.getElementById('editApprovalModal').style.display = 'none';
                await this.loadApprovals();
            } else {
                throw new Error(result.message || 'Failed to update approval request');
            }
        } catch (error) {
            console.error('Error updating approval:', error);
            this.showEditModalError(error.message || 'Failed to update approval request');
        } finally {
            // Reset button state
            if (submitBtn) submitBtn.disabled = false;
            if (btnText) btnText.style.display = 'inline';
            if (spinner) spinner.style.display = 'none';
        }
    }

    // Show edit modal error
    showEditModalError(message) {
        const errorEl = document.getElementById('editApprovalError');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }

    // Hide edit modal error
    hideEditModalError() {
        const errorEl = document.getElementById('editApprovalError');
        if (errorEl) {
            errorEl.style.display = 'none';
            errorEl.textContent = '';
        }
    }

    // Close all modals
    closeAllModals() {
        const createModal = document.getElementById('createApprovalModal');
        const editModal = document.getElementById('editApprovalModal');
        const detailsModal = document.getElementById('approvalDetailsModal');

        if (createModal) createModal.style.display = 'none';
        if (editModal) editModal.style.display = 'none';
        if (detailsModal) detailsModal.style.display = 'none';
    }

    // Utilities
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        alert(`❌ ${message}`);
    }

    showSuccess(message) {
        alert(`✓ ${message}`);
    }

    showModalError(message) {
        const errorEl = document.getElementById('createApprovalError');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }

    hideModalError() {
        const errorEl = document.getElementById('createApprovalError');
        if (errorEl) {
            errorEl.style.display = 'none';
            errorEl.textContent = '';
        }
    }
}
