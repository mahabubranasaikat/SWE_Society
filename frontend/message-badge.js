(function() {
    async function updateMessageBadge() {
        try {
            if (!window.authManager || !window.authManager.isAuthenticated()) {
                return;
            }

            const API = `${window.location.origin}/api`;
            const resp = await window.authManager.authenticatedFetch(`${API}/messages/unread`);
            const data = await resp.json();
            
            if (resp.ok && data.success) {
                const count = data.data.unread_count || 0;
                let badge = document.querySelector('.messages-badge');
                const messagesLink = document.querySelector('a[href*="message.html"]');
                
                if (count > 0) {
                    if (!badge && messagesLink) {
                        badge = document.createElement('span');
                        badge.className = 'messages-badge';
                        messagesLink.style.position = 'relative';
                        messagesLink.appendChild(badge);
                    }
                    if (badge) badge.textContent = count;
                } else if (badge) {
                    badge.remove();
                }
            }
        } catch (err) {
            // Silently fail - user might not be logged in or messages endpoint not available
            console.debug('Could not update message badge:', err);
        }
    }

    // Update on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateMessageBadge);
    } else {
        updateMessageBadge();
    }

    // Poll every 30 seconds (not too frequently to avoid server load)
    setInterval(updateMessageBadge, 30000);
})();
