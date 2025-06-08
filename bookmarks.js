// Bookmarks viewer JavaScript
let allBookmarks = [];
let filteredBookmarks = [];

// Initialize bookmarks viewer
document.addEventListener('DOMContentLoaded', () => {
  loadBookmarks();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  const searchBox = document.getElementById('search-box');
  const refreshBtn = document.getElementById('refresh-btn');
  
  searchBox.addEventListener('input', handleSearch);
  refreshBtn.addEventListener('click', loadBookmarks);
  
  // Handle bookmark clicks
  document.addEventListener('click', (e) => {
    if (e.target.closest('.bookmark-card')) {
      const card = e.target.closest('.bookmark-card');
      const url = card.dataset.url;
      if (url) {
        window.open(url, '_blank');
      }
    }
  });
}

// Load bookmarks from S3
async function loadBookmarks() {
  showLoading();
  
  try {
    // Get AWS configuration
    const config = await chrome.storage.sync.get([
      'awsRegion', 'awsAccessKey', 'awsSecretKey', 's3Bucket'
    ]);
    
    if (!config.s3Bucket) {
      showError('AWS configuration not found. Please configure the extension first.');
      return;
    }
    
    // Get bookmarks from background script
    const response = await chrome.runtime.sendMessage({
      action: 'getBookmarks',
      config: config
    });
    
    if (response.success) {
      await loadBookmarkContents(response.bookmarks, config);
    } else {
      showError(`Error loading bookmarks: ${response.error}`);
    }
  } catch (error) {
    console.error('Error loading bookmarks:', error);
    showError('Error loading bookmarks. Please try again.');
  }
}

// Load individual bookmark contents from S3
async function loadBookmarkContents(bookmarkObjects, config) {
  try {
    const bookmarkPromises = bookmarkObjects.map(async (obj) => {
      try {
        const url = `https://${config.s3Bucket}.s3.${config.awsRegion}.amazonaws.com/${obj.key}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const bookmarkData = await response.json();
          return {
            ...bookmarkData,
            s3Key: obj.key,
            lastModified: obj.lastModified
          };
        } else {
          console.warn(`Failed to load bookmark: ${obj.key}`);
          return null;
        }
      } catch (error) {
        console.warn(`Error loading bookmark ${obj.key}:`, error);
        return null;
      }
    });
    
    const bookmarks = (await Promise.all(bookmarkPromises)).filter(b => b !== null);
    
    // Sort by timestamp (newest first)
    bookmarks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    allBookmarks = bookmarks;
    filteredBookmarks = bookmarks;
    
    displayBookmarks();
  } catch (error) {
    console.error('Error loading bookmark contents:', error);
    showError('Error loading bookmark contents.');
  }
}

// Display bookmarks in the UI
function displayBookmarks() {
  const container = document.getElementById('bookmarks-container');
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const noBookmarks = document.getElementById('no-bookmarks');
  const stats = document.getElementById('stats');
  
  // Hide loading and error states
  loading.style.display = 'none';
  error.style.display = 'none';
  noBookmarks.style.display = 'none';
  
  if (filteredBookmarks.length === 0) {
    if (allBookmarks.length === 0) {
      noBookmarks.style.display = 'block';
    } else {
      container.innerHTML = '<div style="text-align: center; padding: 50px; color: #666;">No bookmarks match your search.</div>';
      container.style.display = 'block';
    }
    stats.textContent = '';
    return;
  }
  
  // Update stats
  stats.textContent = `Showing ${filteredBookmarks.length} of ${allBookmarks.length} bookmarks`;
  
  // Generate HTML for bookmarks
  const bookmarksHTML = filteredBookmarks.map(bookmark => {
    const date = new Date(bookmark.timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const tags = bookmark.tags || [];
    const tagsHTML = tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
    
    return `
      <div class="bookmark-card" data-url="${escapeHtml(bookmark.url)}">
        <div class="bookmark-title">${escapeHtml(bookmark.title)}</div>
        <div class="bookmark-url">${escapeHtml(bookmark.url)}</div>
        <div class="bookmark-date">📅 ${date}</div>
        <div class="bookmark-tags">${tagsHTML}</div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = bookmarksHTML;
  container.style.display = 'grid';
}

// Handle search functionality
function handleSearch(event) {
  const query = event.target.value.toLowerCase().trim();
  
  if (query === '') {
    filteredBookmarks = allBookmarks;
  } else {
    filteredBookmarks = allBookmarks.filter(bookmark => {
      const title = bookmark.title.toLowerCase();
      const url = bookmark.url.toLowerCase();
      const tags = (bookmark.tags || []).map(tag => tag.toLowerCase());
      
      return title.includes(query) || 
             url.includes(query) || 
             tags.some(tag => tag.includes(query));
    });
  }
  
  displayBookmarks();
}

// Show loading state
function showLoading() {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('error').style.display = 'none';
  document.getElementById('bookmarks-container').style.display = 'none';
  document.getElementById('no-bookmarks').style.display = 'none';
  document.getElementById('stats').textContent = '';
}

// Show error state
function showError(message) {
  const errorDiv = document.getElementById('error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  document.getElementById('loading').style.display = 'none';
  document.getElementById('bookmarks-container').style.display = 'none';
  document.getElementById('no-bookmarks').style.display = 'none';
  document.getElementById('stats').textContent = '';
}

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
} 