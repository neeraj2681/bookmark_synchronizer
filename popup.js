// Global variables
let currentTab = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await getCurrentTab();
  await loadConfiguration();
  setupEventListeners();
  checkConfigurationStatus();
});

// Get current active tab
async function getCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;
    
    document.getElementById('page-title').textContent = tab.title || 'Untitled';
    document.getElementById('page-url').textContent = tab.url || '';
  } catch (error) {
    console.error('Error getting current tab:', error);
    showMessage('Error loading current page', 'error');
  }
}

// Load saved configuration
async function loadConfiguration() {
  try {
    const config = await chrome.storage.sync.get([
      'awsRegion', 'awsAccessKey', 'awsSecretKey', 's3Bucket'
    ]);
    
    if (config.awsRegion) document.getElementById('aws-region').value = config.awsRegion;
    if (config.awsAccessKey) document.getElementById('aws-access-key').value = config.awsAccessKey;
    if (config.awsSecretKey) document.getElementById('aws-secret-key').value = config.awsSecretKey;
    if (config.s3Bucket) document.getElementById('s3-bucket').value = config.s3Bucket;
  } catch (error) {
    console.error('Error loading configuration:', error);
  }
}

// Check configuration status and show appropriate message
async function checkConfigurationStatus() {
  try {
    const config = await chrome.storage.sync.get([
      'awsRegion', 'awsAccessKey', 'awsSecretKey', 's3Bucket'
    ]);
    
    if (!config.awsRegion || !config.awsAccessKey || !config.awsSecretKey || !config.s3Bucket) {
      showMessage('⚙️ Please configure AWS settings below to enable one-click saving', 'error');
      document.getElementById('config-form').classList.add('show');
      document.getElementById('toggle-config').textContent = '🔼 Hide Configuration';
    } else {
      showMessage('✅ One-click saving is ready! Just click the extension icon on any page', 'success');
    }
  } catch (error) {
    console.error('Error checking configuration:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('manual-save').addEventListener('click', manualSaveBookmark);
  document.getElementById('save-config').addEventListener('click', saveConfiguration);
  document.getElementById('toggle-config').addEventListener('click', toggleConfigForm);
  document.getElementById('view-bookmarks').addEventListener('click', viewBookmarks);
}

// Toggle configuration form
function toggleConfigForm() {
  const configForm = document.getElementById('config-form');
  const toggleText = document.getElementById('toggle-config');
  
  if (configForm.classList.contains('show')) {
    configForm.classList.remove('show');
    toggleText.textContent = '⚙️ Configure AWS Settings';
  } else {
    configForm.classList.add('show');
    toggleText.textContent = '🔼 Hide Configuration';
  }
}

// Save AWS configuration
async function saveConfiguration() {
  const config = {
    awsRegion: document.getElementById('aws-region').value.trim(),
    awsAccessKey: document.getElementById('aws-access-key').value.trim(),
    awsSecretKey: document.getElementById('aws-secret-key').value.trim(),
    s3Bucket: document.getElementById('s3-bucket').value.trim()
  };
  
  // Validate required fields
  if (!config.awsRegion || !config.awsAccessKey || !config.awsSecretKey || !config.s3Bucket) {
    showMessage('Please fill in all configuration fields', 'error');
    return;
  }
  
  try {
    await chrome.storage.sync.set(config);
    showMessage('✅ Configuration saved! One-click saving is now active', 'success');
    
    // Hide config form after saving
    setTimeout(() => {
      toggleConfigForm();
    }, 2000);
  } catch (error) {
    console.error('Error saving configuration:', error);
    showMessage('Error saving configuration', 'error');
  }
}

// Manual save bookmark (same as one-click, but triggered from popup)
async function manualSaveBookmark() {
  if (!currentTab) {
    showMessage('No active tab found', 'error');
    return;
  }
  
  // Check if configuration exists
  const config = await chrome.storage.sync.get([
    'awsRegion', 'awsAccessKey', 'awsSecretKey', 's3Bucket'
  ]);
  
  if (!config.awsRegion || !config.awsAccessKey || !config.awsSecretKey || !config.s3Bucket) {
    showMessage('Please configure AWS settings first', 'error');
    document.getElementById('config-form').classList.add('show');
    document.getElementById('toggle-config').textContent = '🔼 Hide Configuration';
    return;
  }
  
  const saveButton = document.getElementById('manual-save');
  saveButton.disabled = true;
  saveButton.textContent = '💾 Saving...';
  
  try {
    const bookmark = {
      title: currentTab.title,
      url: currentTab.url,
      timestamp: new Date().toISOString(),
      favicon: currentTab.favIconUrl || ''
    };
    
    // Send message to background script to save to S3
    const response = await chrome.runtime.sendMessage({
      action: 'saveBookmark',
      bookmark: bookmark,
      config: config
    });
    
    if (response.success) {
      showMessage('✅ Bookmark saved successfully!', 'success');
    } else {
      showMessage(`❌ Error: ${response.error}`, 'error');
    }
  } catch (error) {
    console.error('Error saving bookmark:', error);
    showMessage('❌ Error saving bookmark', 'error');
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = '💾 Save This Page Now';
  }
}

// View saved bookmarks
async function viewBookmarks() {
  try {
    const config = await chrome.storage.sync.get([
      'awsRegion', 'awsAccessKey', 'awsSecretKey', 's3Bucket'
    ]);
    
    if (!config.s3Bucket) {
      showMessage('Please configure AWS settings first', 'error');
      document.getElementById('config-form').classList.add('show');
      document.getElementById('toggle-config').textContent = '🔼 Hide Configuration';
      return;
    }
    
    // Send message to background script to get bookmarks
    const response = await chrome.runtime.sendMessage({
      action: 'getBookmarks',
      config: config
    });
    
    if (response.success) {
      // Create a new tab to display bookmarks
      chrome.tabs.create({
        url: chrome.runtime.getURL('bookmarks.html')
      });
    } else {
      showMessage(`❌ Error loading bookmarks: ${response.error}`, 'error');
    }
  } catch (error) {
    console.error('Error loading bookmarks:', error);
    showMessage('❌ Error loading bookmarks', 'error');
  }
}

// Show message to user
function showMessage(text, type) {
  const messageDiv = document.getElementById('message');
  messageDiv.textContent = text;
  messageDiv.className = type;
  
  // Clear message after 5 seconds
  setTimeout(() => {
    messageDiv.textContent = '';
    messageDiv.className = '';
  }, 5000);
} 