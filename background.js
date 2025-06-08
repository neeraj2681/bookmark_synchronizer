// Background service worker for Chrome extension
console.log('Background script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveBookmark') {
    handleSaveBookmark(request.bookmark, request.config)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'getBookmarks') {
    handleGetBookmarks(request.config)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
});

// Handle saving bookmark to S3
async function handleSaveBookmark(bookmark, config) {
  try {
    const fileName = `bookmarks/${Date.now()}-${sanitizeFileName(bookmark.title)}.json`;
    
    const bookmarkData = {
      title: bookmark.title,
      url: bookmark.url,
      timestamp: bookmark.timestamp,
      favicon: bookmark.favicon,
      tags: extractTags(bookmark.title, bookmark.url)
    };
    
    const success = await uploadToS3(
      config.s3Bucket,
      fileName,
      JSON.stringify(bookmarkData, null, 2),
      config
    );
    
    if (success) {
      // Also save to local storage as backup
      await saveToLocalStorage(bookmarkData);
      return { success: true };
    } else {
      throw new Error('Failed to upload to S3');
    }
  } catch (error) {
    console.error('Error saving bookmark:', error);
    return { success: false, error: error.message };
  }
}

// Handle getting bookmarks from S3
async function handleGetBookmarks(config) {
  try {
    const bookmarks = await listS3Objects(config.s3Bucket, 'bookmarks/', config);
    return { success: true, bookmarks: bookmarks };
  } catch (error) {
    console.error('Error getting bookmarks:', error);
    return { success: false, error: error.message };
  }
}

// Upload file to S3
async function uploadToS3(bucket, key, body, config) {
  try {
    const url = `https://${bucket}.s3.${config.awsRegion}.amazonaws.com/${key}`;
    const timestamp = new Date().toISOString();
    
    const headers = await generateS3Headers('PUT', bucket, key, config, body, timestamp);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: headers,
      body: body
    });
    
    if (response.ok) {
      console.log(`Successfully uploaded ${key} to S3`);
      return true;
    } else {
      const errorText = await response.text();
      console.error('S3 upload failed:', response.status, errorText);
      throw new Error(`S3 upload failed: ${response.status} ${errorText}`);
    }
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
}

// List S3 objects
async function listS3Objects(bucket, prefix, config) {
  try {
    const url = `https://${bucket}.s3.${config.awsRegion}.amazonaws.com/?list-type=2&prefix=${prefix}`;
    const timestamp = new Date().toISOString();
    
    const headers = await generateS3Headers('GET', bucket, '', config, '', timestamp);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });
    
    if (response.ok) {
      const xmlText = await response.text();
      return parseS3ListResponse(xmlText);
    } else {
      throw new Error(`Failed to list S3 objects: ${response.status}`);
    }
  } catch (error) {
    console.error('Error listing S3 objects:', error);
    throw error;
  }
}

// Generate S3 authentication headers
async function generateS3Headers(method, bucket, key, config, body, timestamp) {
  const date = timestamp.split('T')[0].replace(/-/g, '');
  const region = config.awsRegion;
  const service = 's3';
  
  // Create canonical request
  const canonicalUri = key ? `/${key}` : '/';
  const canonicalQueryString = method === 'GET' && !key ? 'list-type=2&prefix=bookmarks/' : '';
  const canonicalHeaders = `host:${bucket}.s3.${region}.amazonaws.com\nx-amz-content-sha256:${await sha256(body)}\nx-amz-date:${timestamp.replace(/[-:]/g, '').split('.')[0]}Z\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  
  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${await sha256(body)}`;
  
  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = `${algorithm}\n${timestamp.replace(/[-:]/g, '').split('.')[0]}Z\n${credentialScope}\n${await sha256(canonicalRequest)}`;
  
  // Calculate signature
  const signingKey = await getSignatureKey(config.awsSecretKey, date, region, service);
  const signature = await hmacSha256(signingKey, stringToSign);
  
  // Create authorization header
  const authorization = `${algorithm} Credential=${config.awsAccessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  return {
    'Authorization': authorization,
    'X-Amz-Content-Sha256': await sha256(body),
    'X-Amz-Date': timestamp.replace(/[-:]/g, '').split('.')[0] + 'Z',
    'Content-Type': 'application/json'
  };
}

// Utility functions for AWS signature generation
async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key, message) {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const encoder = new TextEncoder();
  const kDate = await hmacSha256(encoder.encode('AWS4' + key), dateStamp);
  const kRegion = await hmacSha256(new Uint8Array(kDate.match(/.{2}/g).map(h => parseInt(h, 16))), regionName);
  const kService = await hmacSha256(new Uint8Array(kRegion.match(/.{2}/g).map(h => parseInt(h, 16))), serviceName);
  const kSigning = await hmacSha256(new Uint8Array(kService.match(/.{2}/g).map(h => parseInt(h, 16))), 'aws4_request');
  return new Uint8Array(kSigning.match(/.{2}/g).map(h => parseInt(h, 16)));
}

// Parse S3 list response XML
function parseS3ListResponse(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const contents = doc.getElementsByTagName('Contents');
  
  const objects = [];
  for (let i = 0; i < contents.length; i++) {
    const keyElement = contents[i].getElementsByTagName('Key')[0];
    const lastModifiedElement = contents[i].getElementsByTagName('LastModified')[0];
    const sizeElement = contents[i].getElementsByTagName('Size')[0];
    
    if (keyElement) {
      objects.push({
        key: keyElement.textContent,
        lastModified: lastModifiedElement ? lastModifiedElement.textContent : '',
        size: sizeElement ? sizeElement.textContent : '0'
      });
    }
  }
  
  return objects;
}

// Save to local storage as backup
async function saveToLocalStorage(bookmark) {
  try {
    const result = await chrome.storage.local.get(['bookmarks']);
    const bookmarks = result.bookmarks || [];
    bookmarks.push(bookmark);
    
    // Keep only last 100 bookmarks in local storage
    if (bookmarks.length > 100) {
      bookmarks.splice(0, bookmarks.length - 100);
    }
    
    await chrome.storage.local.set({ bookmarks: bookmarks });
  } catch (error) {
    console.error('Error saving to local storage:', error);
  }
}

// Utility functions
function sanitizeFileName(title) {
  return title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-').toLowerCase().substring(0, 50);
}

function extractTags(title, url) {
  const tags = [];
  
  // Extract domain
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    tags.push(domain);
  } catch (e) {
    console.error('Error extracting domain:', e);
  }
  
  // Extract common keywords from title
  const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an'];
  const words = title.toLowerCase().split(/\s+/).filter(word => 
    word.length > 3 && !commonWords.includes(word)
  );
  
  tags.push(...words.slice(0, 5)); // Take first 5 relevant words
  
  return [...new Set(tags)]; // Remove duplicates
} 