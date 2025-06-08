// Content script for extracting page metadata
console.log('Content script loaded');

// Function to extract page metadata
function extractPageMetadata() {
  const metadata = {
    title: document.title,
    url: window.location.href,
    description: '',
    keywords: [],
    author: '',
    image: '',
    canonicalUrl: ''
  };
  
  // Extract meta description
  const descriptionMeta = document.querySelector('meta[name="description"]') || 
                         document.querySelector('meta[property="og:description"]');
  if (descriptionMeta) {
    metadata.description = descriptionMeta.content;
  }
  
  // Extract keywords
  const keywordsMeta = document.querySelector('meta[name="keywords"]');
  if (keywordsMeta) {
    metadata.keywords = keywordsMeta.content.split(',').map(k => k.trim());
  }
  
  // Extract author
  const authorMeta = document.querySelector('meta[name="author"]');
  if (authorMeta) {
    metadata.author = authorMeta.content;
  }
  
  // Extract image
  const imageMeta = document.querySelector('meta[property="og:image"]') ||
                   document.querySelector('meta[name="twitter:image"]');
  if (imageMeta) {
    metadata.image = imageMeta.content;
  }
  
  // Extract canonical URL
  const canonicalLink = document.querySelector('link[rel="canonical"]');
  if (canonicalLink) {
    metadata.canonicalUrl = canonicalLink.href;
  }
  
  return metadata;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageMetadata') {
    const metadata = extractPageMetadata();
    sendResponse({ success: true, metadata: metadata });
  }
  return true;
});

// Automatically extract and cache metadata when page loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const metadata = extractPageMetadata();
    // Store metadata in session storage for quick access
    sessionStorage.setItem('pageMetadata', JSON.stringify(metadata));
  }, 1000);
}); 