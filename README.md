# Bookmark Synchronizer Chrome Extension

A Chrome extension that saves your bookmarks to AWS S3 with **one-click saving** and a beautiful, modern interface.

## ⚡ One-Click Saving

**Just click the extension icon to instantly save any webpage to S3!**

- 🎯 **Instant Save**: No popup needed - just click and save
- 📱 **Visual Feedback**: Badge shows save status (✓ success, ! config needed, ✗ error)
- 🔔 **Notifications**: Get instant feedback with system notifications
- 🔄 **Auto-backup**: Also saves locally as backup
- ⚙️ **Easy Setup**: Configure once, save forever

## Features

- 🚀 **One-click bookmark saving**: Click extension icon to instantly save current page
- 📊 **Visual status badges**: See save status immediately with colored badges
- 🔔 **System notifications**: Get confirmation when bookmarks are saved
- 🖱️ **Right-click menu**: Access settings and bookmarks via right-click
- 🔍 **Search functionality**: Easily search through your saved bookmarks
- 🏷️ **Automatic tagging**: Bookmarks are automatically tagged based on domain and content
- 📱 **Modern UI**: Beautiful, responsive interface with glassmorphism design
- 💾 **Local backup**: Bookmarks are also saved locally as backup
- 🔐 **Secure**: AWS credentials are stored securely in Chrome's sync storage

## Installation

### 1. Download/Clone the Extension
```bash
git clone <repository-url>
cd bookmark_synchronizer
```

### 2. Create Extension Icons
Since Chrome extensions require icons, you'll need to add icon files to the `icons/` directory:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels) 
- `icon128.png` (128x128 pixels)

You can create simple bookmark-themed icons or use any 16x16, 48x48, and 128x128 pixel PNG images.

### 3. Load Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `bookmark_synchronizer` folder
5. The extension should now appear in your extensions list

## AWS Setup

### 1. Create S3 Bucket
1. Log into AWS Console
2. Go to S3 service
3. Create a new bucket (choose any name, remember it)
4. Configure bucket permissions to allow your AWS user to read/write

### 2. Create IAM User
1. Go to IAM service in AWS Console
2. Create a new user with programmatic access
3. Attach the following policy (replace `YOUR-BUCKET-NAME`):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::YOUR-BUCKET-NAME",
                "arn:aws:s3:::YOUR-BUCKET-NAME/*"
            ]
        }
    ]
}
```

4. Save the Access Key ID and Secret Access Key

### 3. Configure CORS (if needed)
If you encounter CORS issues, add this CORS configuration to your S3 bucket:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["chrome-extension://*"],
        "ExposeHeaders": []
    }
]
```

## Usage

### 1. Configure AWS Settings (One-Time Setup)
1. **Right-click** the extension icon
2. Select "⚙️ Configure AWS Settings"
3. Enter your:
   - AWS Region (e.g., `us-east-1`)
   - AWS Access Key ID
   - AWS Secret Access Key  
   - S3 Bucket Name
4. Click "Save Configuration"

### 2. Save Bookmarks (One-Click!)
1. Navigate to any webpage
2. **Simply left-click the extension icon** - that's it!
3. Watch for feedback:
   - **✓ Green badge**: Bookmark saved successfully
   - **! Red badge**: AWS configuration needed
   - **✗ Red badge**: Save failed (check credentials)
   - **🔔 Notification**: System notification with details

### 3. View Bookmarks
1. **Right-click** the extension icon
2. Select "📖 View Bookmarks"
3. Search, browse, and click on bookmarks to open them

## Badge Status System

The extension uses a badge system to give you instant feedback:

| Badge | Color | Meaning |
|-------|-------|---------|
| ⏳ | Blue | Saving in progress |
| ✓ | Green | Bookmark saved successfully |
| ! | Red/Orange | AWS configuration required or invalid page |
| ✗ | Red | Error occurred (check AWS settings) |

Badges appear for 2-3 seconds after clicking the extension icon.

## Interaction Guide

| Action | Result |
|--------|--------|
| **Left-click** extension icon | 🚀 Save current page to S3 |
| **Right-click** extension icon | 📋 Open context menu |
| Right-click → "⚙️ Configure AWS Settings" | 🔧 Open settings page |
| Right-click → "📖 View Bookmarks" | 📖 Open bookmarks viewer |

## File Structure

```
bookmark_synchronizer/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup interface
├── popup.js              # Popup logic and UI handling
├── background.js         # Background service worker for S3 operations
├── content.js            # Content script for page metadata extraction
├── bookmarks.html        # Bookmarks viewer page
├── bookmarks.js          # Bookmarks viewer logic
├── icons/                # Extension icons directory
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md            # This file
```

## Data Format

Bookmarks are saved as JSON files in S3 with the following structure:

```json
{
  "title": "Page Title",
  "url": "https://example.com",
  "timestamp": "2023-12-07T10:30:00.000Z",
  "favicon": "https://example.com/favicon.ico",
  "tags": ["example.com", "keyword1", "keyword2"]
}
```

## Troubleshooting

### Common Issues

1. **Badge shows "!" (Configuration needed)**
   - Right-click the extension icon → "⚙️ Configure AWS Settings"

2. **Badge shows "✗" (Save failed)**
   - Check your AWS credentials
   - Verify S3 bucket permissions
   - Ensure the bucket exists and you have access

3. **No badge or notification appears**
   - Reload the extension in `chrome://extensions/`
   - Check if you're on a valid webpage (http:// or https://)
   - Extension pages, chrome:// pages cannot be bookmarked

4. **"Error loading bookmarks"**
   - Check if S3 bucket is accessible
   - Verify CORS configuration if needed

5. **Extension icon not showing**
   - Make sure icon files exist in the `icons/` directory
   - Reload the extension in `chrome://extensions/`

6. **Context menu not appearing**
   - Make sure you're right-clicking directly on the extension icon
   - Try reloading the extension

### Debug Mode
Open Chrome DevTools and check the Console tab in:
- Extension background script: `chrome://extensions/` → Click "service worker" link
- Settings page: Open settings → F12
- Bookmarks page: Open bookmarks → F12

## Security Notes

- AWS credentials are stored in Chrome's sync storage (encrypted by Chrome)
- Credentials are never transmitted except to AWS S3 endpoints
- Local bookmark backup is stored in Chrome's local storage
- Always use IAM users with minimal required permissions

## Performance

- **Lightning fast**: One-click saves typically complete in under 1 second
- **Background processing**: Saves happen in background without blocking browsing
- **Efficient storage**: JSON format with automatic tagging and metadata
- **Local backup**: Instant fallback if S3 is temporarily unavailable

## License

This project is open source. Feel free to modify and distribute as needed.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**🎯 Quick Start**: 
1. Right-click extension icon → Configure AWS settings
2. Left-click extension icon on any page to save instantly to S3! 