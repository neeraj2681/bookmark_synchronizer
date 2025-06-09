// Bookmarks viewer functionality
console.log('Bookmarks page loaded');

// State variables
let allBookmarks = [];
let filteredBookmarks = [];
let currentPage = 1;
let bookmarksPerPage = 12;
let currentSearchTerm = '';
let userEmail = '';

// DOM elements
const elements = {
    userEmail: document.getElementById('user-email'),
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    clearSearchBtn: document.getElementById('clear-search'),
    exportBtn: document.getElementById('export-btn'),
    refreshBtn: document.getElementById('refresh-btn'),
    loading: document.getElementById('loading'),
    errorMessage: document.getElementById('error-message'),
    emptyState: document.getElementById('empty-state'),
    authRequired: document.getElementById('auth-required'),
    mainContent: document.getElementById('main-content'),
    bookmarksGrid: document.getElementById('bookmarks-grid'),
    stats: document.getElementById('stats'),
    totalBookmarks: document.getElementById('total-bookmarks'),
    shownBookmarks: document.getElementById('shown-bookmarks'),
    pagination: document.getElementById('pagination'),
    prevPage: document.getElementById('prev-page'),
    nextPage: document.getElementById('next-page'),
    pageInfo: document.getElementById('page-info')
};

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await checkAuthentication();
    await loadBookmarks();
});

// Setup event listeners
function setupEventListeners() {
    elements.searchBtn.addEventListener('click', handleSearch);
    elements.clearSearchBtn.addEventListener('click', clearSearch);
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    elements.exportBtn.addEventListener('click', handleExport);
    elements.refreshBtn.addEventListener('click', refreshBookmarks);
    elements.prevPage.addEventListener('click', () => changePage(currentPage - 1));
    elements.nextPage.addEventListener('click', () => changePage(currentPage + 1));
}

// Check if user is authenticated
async function checkAuthentication() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'checkAuth' });
        
        if (!response.success || !response.authenticated) {
            showAuthRequired();
            return false;
        }
        
        userEmail = response.userEmail;
        elements.userEmail.textContent = userEmail;
        return true;
    } catch (error) {
        console.error('Auth check error:', error);
        showAuthRequired();
        return false;
    }
}

// Show authentication required message
function showAuthRequired() {
    elements.authRequired.style.display = 'block';
    elements.mainContent.style.display = 'none';
}

// Load bookmarks from the API
async function loadBookmarks() {
    try {
        showLoading();
        
        const response = await chrome.runtime.sendMessage({
            action: 'getBookmarks',
            limit: 1000, // Get all bookmarks for better client-side filtering
            offset: 0
        });
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to load bookmarks');
        }
        
        allBookmarks = response.data.bookmarks || [];
        filteredBookmarks = [...allBookmarks];
        
        hideLoading();
        updateStats();
        renderBookmarks();
        setupPagination();
        
    } catch (error) {
        console.error('Load bookmarks error:', error);
        showError('Failed to load bookmarks: ' + error.message);
    }
}

// Refresh bookmarks
async function refreshBookmarks() {
    elements.refreshBtn.disabled = true;
    elements.refreshBtn.innerHTML = '🔄 Refreshing...';
    
    await loadBookmarks();
    
    elements.refreshBtn.disabled = false;
    elements.refreshBtn.innerHTML = '🔄 Refresh';
}

// Handle search
function handleSearch() {
    currentSearchTerm = elements.searchInput.value.trim().toLowerCase();
    filterBookmarks();
    currentPage = 1;
    renderBookmarks();
    setupPagination();
}

// Clear search
function clearSearch() {
    elements.searchInput.value = '';
    currentSearchTerm = '';
    filterBookmarks();
    currentPage = 1;
    renderBookmarks();
    setupPagination();
}

// Filter bookmarks based on search term
function filterBookmarks() {
    if (!currentSearchTerm) {
        filteredBookmarks = [...allBookmarks];
    } else {
        filteredBookmarks = allBookmarks.filter(bookmark => {
            const title = bookmark.title.toLowerCase();
            const url = bookmark.url.toLowerCase();
            const tags = (bookmark.tags || []).join(' ').toLowerCase();
            
            return title.includes(currentSearchTerm) ||
                   url.includes(currentSearchTerm) ||
                   tags.includes(currentSearchTerm);
        });
    }
    updateStats();
}

// Update statistics
function updateStats() {
    elements.totalBookmarks.textContent = allBookmarks.length;
    elements.shownBookmarks.textContent = filteredBookmarks.length;
    elements.stats.style.display = allBookmarks.length > 0 ? 'flex' : 'none';
}

// Show loading state
function showLoading() {
    elements.loading.style.display = 'block';
    elements.errorMessage.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.bookmarksGrid.style.display = 'none';
    elements.pagination.style.display = 'none';
}

// Hide loading state
function hideLoading() {
    elements.loading.style.display = 'none';
}

// Show error message
function showError(message) {
    hideLoading();
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.display = 'block';
    elements.emptyState.style.display = 'none';
    elements.bookmarksGrid.style.display = 'none';
    elements.pagination.style.display = 'none';
}

// Render bookmarks
function renderBookmarks() {
    const startIndex = (currentPage - 1) * bookmarksPerPage;
    const endIndex = startIndex + bookmarksPerPage;
    const bookmarksToShow = filteredBookmarks.slice(startIndex, endIndex);
    
    if (filteredBookmarks.length === 0) {
        showEmptyState();
        return;
    }
    
    elements.errorMessage.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.bookmarksGrid.style.display = 'grid';
    
    elements.bookmarksGrid.innerHTML = bookmarksToShow.map(bookmark => createBookmarkCard(bookmark)).join('');
}

// Show empty state
function showEmptyState() {
    elements.emptyState.style.display = 'block';
    elements.bookmarksGrid.style.display = 'none';
    elements.pagination.style.display = 'none';
}

// Create bookmark card HTML
function createBookmarkCard(bookmark) {
    const title = escapeHtml(bookmark.title || 'Untitled');
    const url = bookmark.url || '#';
    const favicon = bookmark.favicon || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
    const tags = bookmark.tags || [];
    const date = bookmark.timestamp ? new Date(bookmark.timestamp).toLocaleDateString() : 'Unknown date';
    const domain = extractDomain(url);
    
    return `
        <div class="bookmark-card">
            <div class="bookmark-header">
                <img src="${favicon}" alt="Favicon" class="bookmark-favicon" 
                     onerror="this.src='data:image/svg+xml,<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;%23667eea&quot;><path d=&quot;M12 2l2.09 6.26L20 9l-5.91.74L12 16l-2.09-6.26L4 9l5.91-.74L12 2z&quot;/></svg>'">
                <div style="flex: 1;">
                    <div class="bookmark-title">${title}</div>
                    <a href="${url}" class="bookmark-url" target="_blank" rel="noopener noreferrer">
                        ${domain}
                    </a>
                </div>
            </div>
            
            ${tags.length > 0 ? `
                <div class="bookmark-tags">
                    ${tags.slice(0, 5).map(tag => `<span class="bookmark-tag">${escapeHtml(tag)}</span>`).join('')}
                    ${tags.length > 5 ? `<span class="bookmark-tag">+${tags.length - 5} more</span>` : ''}
                </div>
            ` : ''}
            
            <div class="bookmark-meta">
                <span class="bookmark-date">📅 ${date}</span>
                <button class="btn btn-secondary" onclick="openBookmark('${url}')" style="padding: 5px 10px; font-size: 12px;">
                    🔗 Open
                </button>
            </div>
        </div>
    `;
}

// Extract domain from URL
function extractDomain(url) {
    try {
        const domain = new URL(url).hostname;
        return domain.replace('www.', '');
    } catch {
        return url.length > 50 ? url.substring(0, 50) + '...' : url;
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Open bookmark in new tab
function openBookmark(url) {
    chrome.tabs.create({ url: url });
}

// Setup pagination
function setupPagination() {
    const totalPages = Math.ceil(filteredBookmarks.length / bookmarksPerPage);
    
    if (totalPages <= 1) {
        elements.pagination.style.display = 'none';
        return;
    }
    
    elements.pagination.style.display = 'flex';
    elements.prevPage.disabled = currentPage === 1;
    elements.nextPage.disabled = currentPage === totalPages;
    elements.pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}

// Change page
function changePage(newPage) {
    const totalPages = Math.ceil(filteredBookmarks.length / bookmarksPerPage);
    
    if (newPage < 1 || newPage > totalPages) return;
    
    currentPage = newPage;
    renderBookmarks();
    setupPagination();
    
    // Scroll to top
    document.querySelector('.container').scrollIntoView({ behavior: 'smooth' });
}

// Handle export to CSV
async function handleExport() {
    try {
        elements.exportBtn.disabled = true;
        elements.exportBtn.innerHTML = '📥 Exporting...';
        
        const response = await chrome.runtime.sendMessage({
            action: 'exportBookmarks'
        });
        
        if (!response.success) {
            throw new Error(response.error || 'Export failed');
        }
        
        // Create and download CSV file
        const blob = new Blob([response.csvData], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bookmarks-${userEmail}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Show success message
        showTemporaryMessage('✅ Bookmarks exported successfully!', 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        showTemporaryMessage('❌ Export failed: ' + error.message, 'error');
    } finally {
        elements.exportBtn.disabled = false;
        elements.exportBtn.innerHTML = '📥 Export CSV';
    }
}

// Show temporary message
function showTemporaryMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        background: ${type === 'success' ? '#48bb78' : type === 'error' ? '#f56565' : '#667eea'};
    `;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(messageDiv);
        }, 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Global function for opening bookmarks (called from HTML)
window.openBookmark = openBookmark; 