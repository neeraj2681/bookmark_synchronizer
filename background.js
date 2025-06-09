// Background service worker for Chrome extension with API authentication
console.log('Background script loaded');

// Create context menu when extension installs
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "openAuth",
    title: "🔐 Login / Sign Up",
    contexts: ["action"]
  });
  
  chrome.contextMenus.create({
    id: "viewBookmarks", 
    title: "📖 View Bookmarks",
    contexts: ["action"]
  });

  chrome.contextMenus.create({
    id: "logout",
    title: "🚪 Logout",
    contexts: ["action"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "openAuth") {
    chrome.tabs.create({
      url: chrome.runtime.getURL('auth.html')
    });
  } else if (info.menuItemId === "viewBookmarks") {
    chrome.tabs.create({
      url: chrome.runtime.getURL('bookmarks.html')
    });
  } else if (info.menuItemId === "logout") {
    await handleLogout();
  }
});

// Listen for extension icon clicks - ONE CLICK SAVE
chrome.action.onClicked.addListener(async (tab) => {
  console.log('Extension icon clicked, auto-saving bookmark for:', tab.url);
  await autoSaveBookmark(tab);
});

// Auto-save bookmark when extension icon is clicked
async function autoSaveBookmark(tab) {
  try {
    // Skip non-http(s) pages
    if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
      chrome.action.setBadgeText({ text: '!', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#ff9800' });
      
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '', tabId: tab.id });
      }, 3000);
      
      console.log('Cannot bookmark this page type:', tab.url);
      return;
    }
    
    // Check authentication
    const authData = await chrome.storage.sync.get([
      'accessToken', 'userEmail', 'apiServer'
    ]);
    
    if (!authData.accessToken || !authData.userEmail || !authData.apiServer) {
      // Show badge to indicate auth needed
      chrome.action.setBadgeText({ text: '!', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#ff4444' });
      
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '', tabId: tab.id });
      }, 3000);
      
      console.log('Authentication required - right-click extension icon to login');
      
      // Show notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Bookmark Sync',
        message: 'Please login first. Right-click the extension icon to authenticate.'
      });
      
      return;
    }
    
    // Show saving indicator
    chrome.action.setBadgeText({ text: '⏳', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#2196F3' });
    
    // Create bookmark object
    const bookmark = {
      title: tab.title || 'Untitled',
      url: tab.url,
      favicon: tab.favIconUrl || ''
    };
    
    console.log('Saving bookmark:', bookmark);
    
    // Save bookmark via API
    const result = await saveBookmarkToAPI(bookmark, authData);
    
    if (result.success) {
      // Show success badge
      chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
      
      // Clear badge after 2 seconds
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '', tabId: tab.id });
      }, 2000);
      
      console.log('Bookmark saved successfully');
      
      // Show success notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Bookmark Saved!',
        message: `"${bookmark.title}" saved successfully`
      });
      
    } else {
      // Show error badge
      chrome.action.setBadgeText({ text: '✗', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
      
      // Clear badge after 3 seconds
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '', tabId: tab.id });
      }, 3000);
      
      console.error('Failed to save bookmark:', result.error);
      
      // Show error notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Save Failed',
        message: `Error: ${result.error}`
      });
    }
  } catch (error) {
    console.error('Error in auto-save:', error);
    
    // Show error badge
    chrome.action.setBadgeText({ text: '✗', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
    
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '', tabId: tab.id });
    }, 3000);
    
    // Show error notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Save Failed',
      message: 'An unexpected error occurred'
    });
  }
}

// Save bookmark to API
async function saveBookmarkToAPI(bookmark, authData) {
  try {
    const response = await fetch(`${authData.apiServer}/api/bookmarks/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.accessToken}`
      },
      body: JSON.stringify(bookmark)
    });

    const data = await response.json();

    if (response.ok) {
      // Save to local storage as backup
      await saveToLocalStorage(data.bookmark);
      return { success: true, data };
    } else {
      // Handle token expiration
      if (response.status === 401) {
        const refreshResult = await refreshAccessToken(authData);
        if (refreshResult.success) {
          // Retry with new token
          return await saveBookmarkToAPI(bookmark, {
            ...authData,
            accessToken: refreshResult.accessToken
          });
        } else {
          return { success: false, error: 'Authentication expired. Please login again.' };
        }
      }
      
      return { success: false, error: data.error || 'Failed to save bookmark' };
    }

  } catch (error) {
    console.error('API error:', error);
    return { success: false, error: 'Network error. Please check your connection.' };
  }
}

// Refresh access token
async function refreshAccessToken(authData) {
  try {
    const response = await fetch(`${authData.apiServer}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refreshToken: authData.refreshToken
      })
    });

    const data = await response.json();

    if (response.ok) {
      // Update stored tokens
      await chrome.storage.sync.set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || authData.refreshToken
      });
      
      return { success: true, accessToken: data.accessToken };
    } else {
      // Refresh failed, user needs to login again
      await handleLogout();
      return { success: false, error: 'Session expired' };
    }

  } catch (error) {
    console.error('Token refresh error:', error);
    return { success: false, error: 'Failed to refresh token' };
  }
}

// Handle logout
async function handleLogout() {
  try {
    // Get current auth data
    const authData = await chrome.storage.sync.get(['accessToken', 'apiServer']);
    
    // Call logout API if we have a token
    if (authData.accessToken && authData.apiServer) {
      try {
        await fetch(`${authData.apiServer}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authData.accessToken}`
          }
        });
      } catch (error) {
        console.error('Logout API error:', error);
        // Continue with local logout even if API call fails
      }
    }
    
    // Clear stored auth data
    await chrome.storage.sync.remove([
      'accessToken', 'refreshToken', 'userEmail'
    ]);
    
    // Show logout notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Logged Out',
      message: 'You have been logged out successfully'
    });
    
    console.log('User logged out');
    
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveBookmark') {
    handleSaveBookmarkMessage(request)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'getBookmarks') {
    handleGetBookmarksMessage(request)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }

  if (request.action === 'exportBookmarks') {
    handleExportBookmarksMessage(request)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'checkAuth') {
    handleCheckAuth()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Handle save bookmark message
async function handleSaveBookmarkMessage(request) {
  const authData = await chrome.storage.sync.get([
    'accessToken', 'userEmail', 'apiServer'
  ]);
  
  if (!authData.accessToken) {
    return { success: false, error: 'Not authenticated' };
  }
  
  return await saveBookmarkToAPI(request.bookmark, authData);
}

// Handle get bookmarks message
async function handleGetBookmarksMessage(request) {
  try {
    const authData = await chrome.storage.sync.get([
      'accessToken', 'userEmail', 'apiServer'
    ]);
    
    if (!authData.accessToken) {
      return { success: false, error: 'Not authenticated' };
    }

    const { limit = 50, offset = 0, search } = request;
    let endpoint = `${authData.apiServer}/api/bookmarks/list?limit=${limit}&offset=${offset}`;
    
    if (search) {
      endpoint = `${authData.apiServer}/api/bookmarks/search?q=${encodeURIComponent(search)}&limit=${limit}`;
    }

    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${authData.accessToken}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, data };
    } else {
      if (response.status === 401) {
        const refreshResult = await refreshAccessToken(authData);
        if (refreshResult.success) {
          // Retry with new token
          return await handleGetBookmarksMessage(request);
        }
      }
      return { success: false, error: data.error || 'Failed to fetch bookmarks' };
    }

  } catch (error) {
    console.error('Get bookmarks error:', error);
    return { success: false, error: 'Network error' };
  }
}

// Handle export bookmarks message
async function handleExportBookmarksMessage(request) {
  try {
    const authData = await chrome.storage.sync.get([
      'accessToken', 'userEmail', 'apiServer'
    ]);
    
    if (!authData.accessToken) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${authData.apiServer}/api/bookmarks/export/csv`, {
      headers: {
        'Authorization': `Bearer ${authData.accessToken}`
      }
    });

    if (response.ok) {
      const csvData = await response.text();
      return { success: true, csvData };
    } else {
      const data = await response.json();
      return { success: false, error: data.error || 'Export failed' };
    }

  } catch (error) {
    console.error('Export error:', error);
    return { success: false, error: 'Network error' };
  }
}

// Handle check authentication
async function handleCheckAuth() {
  try {
    const authData = await chrome.storage.sync.get([
      'accessToken', 'userEmail', 'apiServer'
    ]);
    
    return {
      success: true,
      authenticated: !!(authData.accessToken && authData.userEmail),
      userEmail: authData.userEmail
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Save to local storage as backup
async function saveToLocalStorage(bookmark) {
  try {
    const result = await chrome.storage.local.get(['localBookmarks']);
    const localBookmarks = result.localBookmarks || [];
    
    // Add new bookmark to the beginning
    localBookmarks.unshift(bookmark);
    
    // Keep only last 100 bookmarks locally
    if (localBookmarks.length > 100) {
      localBookmarks.splice(100);
    }
    
    await chrome.storage.local.set({ localBookmarks });
    console.log('Bookmark saved to local storage');
    
  } catch (error) {
    console.error('Error saving to local storage:', error);
  }
} 