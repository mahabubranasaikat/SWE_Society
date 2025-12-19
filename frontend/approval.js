// ==================== APPROVAL FEATURE ====================

class ApprovalManager {
    constructor(apiBase) {
        this.apiBase = apiBase;
        this.currentUser = null;
        this.approvals = [];
        this.selectedApproval = null;
    }

    // Initialize
    async init() {
        this.currentUser = JSON.parse(localStorage.getItem('Swe_Society_user'));
        await this.loadApprovals();
        this.setupEventListeners();
    }

    // Load all approvals
    async loadApprovals() {
        try {
            const response = await fetch(`${this.apiBase}/approvals/list?status=all&filterType=all`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('Swe_Society_token')}` }
            });
            const result = await response.json();
            
            if (result.success) {
                this.approvals = result.data;
                this.renderApprovalsList();
            }
        } catch (error) {
            console.error('Error loading approvals:', error);
            this.showError('Failed to load approvals');
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
        if (!container) return;

        if (this.approvals.length === 0) {
            container.innerHTML = '<div class="empty-state">No approval requests found</div>';
            return;
        }

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
                    ${this.currentUser && this.currentUser.id === approval.creator_id ? `
                        <button class="btn-small btn-edit" onclick="approvalManager.showEditModal(${approval.id})">Edit</button>
                        <button class="btn-small btn-delete" onclick="approvalManager.deleteApproval(${approval.id})">Delete</button>
                        ${approval.status === 'active' ? `<button class="btn-small btn-complete" onclick="approvalManager.completeApproval(${approval.id})">Mark Complete</button>` : ''}
                    ` : ''}
                </div>
            </div>
        `).join('');

        // Update count
        const countElement = document.getElementById('approvalsCount');
        if (countElement) {
            countElement.textContent = this.approvals.length;
        }
    }

    // Show approval details modal
    async showDetails(id) {
        try {
            const response = await fetch(`${this.apiBase}/approvals/${id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('Swe_Society_token')}` }
            });
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

                            ${this.currentUser && this.currentUser.id !== data.creator_id ? `
                                <div class="approval-detail-section">
                                    <h4>Your Response</h4>
                                    ${data.recipients.some(r => r.user_id === this.currentUser.id && r.status === 'pending') ? `
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
                                    ` : data.recipients.find(r => r.user_id === this.currentUser.id) ? `
                                        <p class="your-response">
                                            Your response: <strong>${data.recipients.find(r => r.user_id === this.currentUser.id).status}</strong>
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
                    <form id="createApprovalForm">
                        <div class="form-group">
                            <label for="approvalTitle">Title *</label>
                            <input type="text" id="approvalTitle" required placeholder="Enter approval request title">
                        </div>

                        <div class="form-group">
                            <label for="approvalDescription">Description</label>
                            <textarea id="approvalDescription" placeholder="Enter approval request description"></textarea>
                        </div>

                        <div class="form-group">
                            <label for="approvalDeadline">Deadline</label>
                            <input type="datetime-local" id="approvalDeadline">
                        </div>

                        <div class="form-group">
                            <label for="recipientSelect">Select Recipients * (Hold Ctrl/Cmd for multiple)</label>
                            <select id="recipientSelect" multiple required size="8"></select>
                            <small>Selected: <span id="selectedCount">0</span> users</small>
                        </div>

                        <div class="button-group">
                            <button type="submit" class="btn btn-primary">Create Request</button>
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-content').parentElement.style.display='none'">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Load users for recipient selection
        this.loadUsersForSelection();

        document.getElementById('recipientSelect').addEventListener('change', () => {
            document.getElementById('selectedCount').textContent = 
                document.getElementById('recipientSelect').selectedOptions.length;
        });

        document.getElementById('createApprovalForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createApproval();
        });

        modal.style.display = 'block';
    }

    // Load users for recipient selection
    async loadUsersForSelection() {
        try {
            // Ensure currentUser is loaded
            if (!this.currentUser) {
                this.currentUser = JSON.parse(localStorage.getItem('Swe_Society_user'));
            }

            const token = localStorage.getItem('Swe_Society_token');
            if (!token) {
                this.showError('Authentication required');
                return;
            }

            const response = await fetch(`${this.apiBase}/profile/users/all`, {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success && result.data) {
                const select = document.getElementById('recipientSelect');
                if (!select) {
                    console.error('recipient select element not found');
                    return;
                }
                
                const currentUserId = this.currentUser?.id;
                select.innerHTML = result.data
                    .filter(u => u.id !== currentUserId) // Exclude current user
                    .map(u => `<option value="${u.id}">${u.name} (${u.username})</option>`)
                    .join('');
                
                if (select.options.length === 0) {
                    select.innerHTML = '<option disabled>No other users available</option>';
                }
            } else {
                console.error('API Error loading users:', result.message);
                this.showError(result.message || 'Failed to load users for recipient selection');
            }
        } catch (error) {
            console.error('Fetch Error loading users:', error);
            this.showError(`Error loading users: ${error.message}`);
        }
    }

    // Create approval
    async createApproval() {
        try {
            const title = document.getElementById('approvalTitle').value;
            const description = document.getElementById('approvalDescription').value;
            const deadline = document.getElementById('approvalDeadline').value;
            const recipientIds = Array.from(document.getElementById('recipientSelect').selectedOptions)
                .map(option => parseInt(option.value));

            if (!title || recipientIds.length === 0) {
                this.showError('Title and at least one recipient are required');
                return;
            }

            const token = localStorage.getItem('Swe_Society_token');
            console.log('Token available:', !!token);
            console.log('Token:', token ? token.substring(0, 20) + '...' : 'NO TOKEN');

            const response = await fetch(`${this.apiBase}/approvals/create`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title,
                    description: description || null,
                    deadline: deadline || null,
                    recipientIds
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess('Approval request created successfully');
                document.getElementById('createApprovalModal').style.display = 'none';
                await this.loadApprovals();
            } else {
                this.showError(result.message || 'Failed to create approval request');
            }
        } catch (error) {
            console.error('Error creating approval:', error);
            this.showError('Failed to create approval request');
        }
    }

    // Submit response
    async submitResponse(id, status) {
        try {
            const notes = document.getElementById('responseNotes')?.value || '';

            const response = await fetch(`${this.apiBase}/approvals/${id}/respond`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('Swe_Society_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    approvalStatus: status,
                    notes: notes || null
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess(`Request ${status} successfully`);
                document.getElementById('approvalDetailsModal').style.display = 'none';
                await this.loadApprovals();
            } else {
                this.showError(result.message || 'Failed to submit response');
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
            const response = await fetch(`${this.apiBase}/approvals/${id}/delete`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('Swe_Society_token')}` }
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess('Approval request deleted successfully');
                await this.loadApprovals();
            } else {
                this.showError(result.message || 'Failed to delete approval request');
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
            const response = await fetch(`${this.apiBase}/approvals/${id}/complete`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('Swe_Society_token')}` }
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess('Approval request completed successfully');
                await this.loadApprovals();
            } else {
                this.showError(result.message || 'Failed to complete approval request');
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
            if (type === 'created') return a.creator_id === this.currentUser?.id;
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
    showEditModal(id) {
        // TODO: Implement edit functionality
        this.showError('Edit functionality coming soon');
    }

    // Close all modals
    closeAllModals() {
        document.getElementById('createApprovalModal').style.display = 'none';
        document.getElementById('approvalDetailsModal').style.display = 'none';
    }

    // Utilities
    escapeHtml(text) {
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
}

// Initialize globally
let approvalManager;
