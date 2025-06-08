# Bookmark Synchronizer Chrome Extension

A Chrome extension that saves your bookmarks to AWS S3 with a beautiful, modern interface.

## Features

- 📚 **Save bookmarks to S3**: Click the extension icon to save the current page to your S3 bucket
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

### 1. Configure AWS Settings
1. Click the extension icon
2. Click "⚙️ Configure AWS Settings"
3. Enter your:
   - AWS Region (e.g., `us-east-1`)
   - AWS Access Key ID
   - AWS Secret Access Key  
   - S3 Bucket Name
4. Click "Save Configuration"

### 2. Save Bookmarks
1. Navigate to any webpage
2. Click the extension icon
3. Click "Save to S3"
4. The bookmark will be saved with title, URL, timestamp, and auto-generated tags

### 3. View Bookmarks
1. Click the extension icon
2. Click "View Saved Bookmarks"
3. Search, browse, and click on bookmarks to open them

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

1. **"AWS configuration not found"**
   - Make sure you've configured AWS settings in the extension popup

2. **"S3 upload failed"**
   - Check your AWS credentials
   - Verify S3 bucket permissions
   - Ensure the bucket exists and you have access

3. **"Error loading bookmarks"**
   - Check if S3 bucket is accessible
   - Verify CORS configuration if needed

4. **Extension icon not showing**
   - Make sure icon files exist in the `icons/` directory
   - Reload the extension in `chrome://extensions/`

### Debug Mode
Open Chrome DevTools and check the Console tab in:
- Extension popup (right-click extension icon → "Inspect popup")
- Background script (`chrome://extensions/` → "background page")
- Bookmarks page (F12 when viewing bookmarks)

## Security Notes

- AWS credentials are stored in Chrome's sync storage (encrypted by Chrome)
- Credentials are never transmitted except to AWS S3 endpoints
- Local bookmark backup is stored in Chrome's local storage
- Always use IAM users with minimal required permissions

## License

This project is open source. Feel free to modify and distribute as needed.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**Note**: Remember to create the required icon files before loading the extension in Chrome. The extension will not work without the icon files specified in the manifest. 