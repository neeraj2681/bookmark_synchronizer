// Authentication handling for Chrome Extension
console.log('Auth script loaded');

// DOM elements
const tabButtons = document.querySelectorAll('.tab-button');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');
const apiServerInput = document.getElementById('api-server');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadSavedSettings();
    setupTabSwitching();
    setupFormHandlers();
    await checkExistingAuth();
});

// Load saved API server URL
async function loadSavedSettings() {
    try {
        const result = await chrome.storage.sync.get(['apiServer']);
        if (result.apiServer) {
            apiServerInput.value = result.apiServer;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Save API server URL
async function saveApiServer() {
    try {
        await chrome.storage.sync.set({
            apiServer: apiServerInput.value.trim()
        });
    } catch (error) {
        console.error('Error saving API server:', error);
    }
}

// Check if user is already authenticated
async function checkExistingAuth() {
    try {
        const result = await chrome.storage.sync.get(['accessToken', 'userEmail']);
        if (result.accessToken && result.userEmail) {
            showSuccess('Already logged in as ' + result.userEmail);
            // Could redirect to bookmarks view or show logout option
        }
    } catch (error) {
        console.error('Error checking auth:', error);
    }
}

// Tab switching functionality
function setupTabSwitching() {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            switchTab(targetTab);
        });
    });
}

function switchTab(tab) {
    // Update tab buttons
    tabButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        }
    });

    // Show/hide forms
    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
    } else {
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
    }

    clearMessages();
}

// Form handlers
function setupFormHandlers() {
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);
    
    // Save API server URL when it changes
    apiServerInput.addEventListener('blur', saveApiServer);
}

// Handle login
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const apiServer = apiServerInput.value.trim();
    
    if (!validateInputs(email, password, apiServer)) {
        return;
    }

    setLoading('login-button', true);
    clearMessages();

    try {
        const response = await fetch(`${apiServer}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Save tokens and user info
            await chrome.storage.sync.set({
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                userEmail: email,
                apiServer: apiServer
            });

            showSuccess('Login successful! You can now save bookmarks.');
            
            // Close the auth window after a delay
            setTimeout(() => {
                window.close();
            }, 2000);

        } else {
            showError(data.error || 'Login failed');
        }

    } catch (error) {
        console.error('Login error:', error);
        showError('Connection failed. Please check your API server URL.');
    } finally {
        setLoading('login-button', false);
    }
}

// Handle signup
async function handleSignup(event) {
    event.preventDefault();
    
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const apiServer = apiServerInput.value.trim();
    
    if (!validateInputs(email, password, apiServer)) {
        return;
    }

    if (password !== confirmPassword) {
        showError('Passwords do not match');
        return;
    }

    if (!validatePassword(password)) {
        showError('Password must contain at least 8 characters with uppercase, lowercase, and number');
        return;
    }

    setLoading('signup-button', true);
    clearMessages();

    try {
        const response = await fetch(`${apiServer}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Save tokens and user info
            await chrome.storage.sync.set({
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                userEmail: email,
                apiServer: apiServer
            });

            showSuccess('Account created successfully! You can now save bookmarks.');
            
            // Close the auth window after a delay
            setTimeout(() => {
                window.close();
            }, 2000);

        } else {
            showError(data.error || 'Registration failed');
        }

    } catch (error) {
        console.error('Signup error:', error);
        showError('Connection failed. Please check your API server URL.');
    } finally {
        setLoading('signup-button', false);
    }
}

// Validation functions
function validateInputs(email, password, apiServer) {
    if (!email) {
        showError('Email is required');
        return false;
    }

    if (!isValidEmail(email)) {
        showError('Please enter a valid email address');
        return false;
    }

    if (!password) {
        showError('Password is required');
        return false;
    }

    if (!apiServer) {
        showError('API Server URL is required');
        return false;
    }

    try {
        new URL(apiServer);
    } catch {
        showError('Please enter a valid API Server URL');
        return false;
    }

    return true;
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasMinLength = password.length >= 8;
    
    return hasUpperCase && hasLowerCase && hasNumbers && hasMinLength;
}

// UI helper functions
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    successMessage.classList.add('hidden');
}

function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.classList.remove('hidden');
    errorMessage.classList.add('hidden');
}

function clearMessages() {
    errorMessage.classList.add('hidden');
    successMessage.classList.add('hidden');
}

function setLoading(buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    const buttonText = button.querySelector('.button-text');
    
    if (isLoading) {
        button.disabled = true;
        buttonText.innerHTML = '<span class="loading"></span>Processing...';
    } else {
        button.disabled = false;
        if (buttonId === 'login-button') {
            buttonText.textContent = 'Sign In';
        } else {
            buttonText.textContent = 'Create Account';
        }
    }
}

// Help link handler
document.getElementById('help-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
        url: 'https://github.com/your-org/bookmark-sync-extension#setup'
    });
}); 