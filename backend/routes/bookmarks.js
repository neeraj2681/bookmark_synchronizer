const express = require('express');
const AWS = require('aws-sdk');
const Joi = require('joi');

const router = express.Router();

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

// Validation schema for bookmark
const bookmarkSchema = Joi.object({
  title: Joi.string().max(1000).required(),
  url: Joi.string().uri().required(),
  favicon: Joi.string().uri().allow('').optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional()
});

// Helper functions
function sanitizeFileName(title) {
  return title
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .substring(0, 100);
}

function extractTags(title, url) {
  const tags = [];
  
  // Extract domain
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    tags.push(domain);
  } catch (e) {
    // Invalid URL, skip domain tag
  }
  
  // Extract words from title (simple implementation)
  const titleWords = title.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && word.length < 20)
    .slice(0, 5);
  
  tags.push(...titleWords);
  
  return [...new Set(tags)]; // Remove duplicates
}

function getUserS3Prefix(userEmail) {
  return `users/${userEmail}/bookmarks/`;
}

// POST /api/bookmarks/save
router.post('/save', async (req, res) => {
  try {
    // Validate input
    const { error, value } = bookmarkSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => detail.message)
      });
    }

    const { title, url, favicon, tags } = value;
    const userEmail = req.user.email;

    // Create bookmark object
    const timestamp = new Date().toISOString();
    const bookmarkData = {
      title,
      url,
      timestamp,
      favicon: favicon || '',
      tags: tags || extractTags(title, url),
      userEmail,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    // Generate S3 key
    const fileName = `${Date.now()}-${sanitizeFileName(title)}.json`;
    const s3Key = `${getUserS3Prefix(userEmail)}${fileName}`;

    // Upload to S3
    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: JSON.stringify(bookmarkData, null, 2),
      ContentType: 'application/json',
      ServerSideEncryption: 'AES256'
    };

    await s3.upload(uploadParams).promise();

    res.status(201).json({
      message: 'Bookmark saved successfully',
      bookmark: bookmarkData,
      s3Key
    });

  } catch (error) {
    console.error('Save bookmark error:', error);
    
    if (error.code === 'NoSuchBucket') {
      return res.status(500).json({ error: 'S3 bucket not configured properly' });
    }
    
    if (error.code === 'AccessDenied') {
      return res.status(500).json({ error: 'S3 access denied - check AWS credentials' });
    }
    
    res.status(500).json({ error: 'Failed to save bookmark' });
  }
});

// GET /api/bookmarks/list
router.get('/list', async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { limit = 50, offset = 0 } = req.query;
    
    // List objects in user's S3 folder
    const listParams = {
      Bucket: BUCKET_NAME,
      Prefix: getUserS3Prefix(userEmail),
      MaxKeys: parseInt(limit) + parseInt(offset)
    };

    const result = await s3.listObjectsV2(listParams).promise();
    
    if (!result.Contents || result.Contents.length === 0) {
      return res.json({
        bookmarks: [],
        total: 0,
        hasMore: false
      });
    }

    // Sort by LastModified (newest first) and apply pagination
    const sortedObjects = result.Contents
      .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    // Fetch bookmark data
    const bookmarks = await Promise.all(
      sortedObjects.map(async (object) => {
        try {
          const getParams = {
            Bucket: BUCKET_NAME,
            Key: object.Key
          };
          
          const data = await s3.getObject(getParams).promise();
          return JSON.parse(data.Body.toString());
        } catch (error) {
          console.error(`Error fetching bookmark ${object.Key}:`, error);
          return null;
        }
      })
    );

    // Filter out failed fetches
    const validBookmarks = bookmarks.filter(bookmark => bookmark !== null);

    res.json({
      bookmarks: validBookmarks,
      total: result.Contents.length,
      hasMore: result.Contents.length > parseInt(offset) + parseInt(limit)
    });

  } catch (error) {
    console.error('List bookmarks error:', error);
    res.status(500).json({ error: 'Failed to fetch bookmarks' });
  }
});

// GET /api/bookmarks/search
router.get('/search', async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { q: query, limit = 50 } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // List all user's bookmarks
    const listParams = {
      Bucket: BUCKET_NAME,
      Prefix: getUserS3Prefix(userEmail)
    };

    const result = await s3.listObjectsV2(listParams).promise();
    
    if (!result.Contents || result.Contents.length === 0) {
      return res.json({ bookmarks: [] });
    }

    // Fetch and search through bookmarks
    const searchResults = [];
    const searchTerm = query.toLowerCase();

    for (const object of result.Contents) {
      try {
        const getParams = {
          Bucket: BUCKET_NAME,
          Key: object.Key
        };
        
        const data = await s3.getObject(getParams).promise();
        const bookmark = JSON.parse(data.Body.toString());

        // Simple search in title, URL, and tags
        const titleMatch = bookmark.title.toLowerCase().includes(searchTerm);
        const urlMatch = bookmark.url.toLowerCase().includes(searchTerm);
        const tagsMatch = bookmark.tags && bookmark.tags.some(tag => 
          tag.toLowerCase().includes(searchTerm)
        );

        if (titleMatch || urlMatch || tagsMatch) {
          searchResults.push({
            ...bookmark,
            relevanceScore: titleMatch ? 3 : (urlMatch ? 2 : 1)
          });
        }

        // Limit results for performance
        if (searchResults.length >= parseInt(limit)) {
          break;
        }
      } catch (error) {
        console.error(`Error searching bookmark ${object.Key}:`, error);
      }
    }

    // Sort by relevance score
    searchResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    res.json({
      bookmarks: searchResults.map(({ relevanceScore, ...bookmark }) => bookmark),
      query,
      total: searchResults.length
    });

  } catch (error) {
    console.error('Search bookmarks error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/bookmarks/export/csv
router.get('/export/csv', async (req, res) => {
  try {
    const userEmail = req.user.email;

    // List all user's bookmarks
    const listParams = {
      Bucket: BUCKET_NAME,
      Prefix: getUserS3Prefix(userEmail)
    };

    const result = await s3.listObjectsV2(listParams).promise();
    
    if (!result.Contents || result.Contents.length === 0) {
      return res.status(404).json({ error: 'No bookmarks found' });
    }

    // Fetch all bookmarks
    const bookmarks = [];
    for (const object of result.Contents) {
      try {
        const getParams = {
          Bucket: BUCKET_NAME,
          Key: object.Key
        };
        
        const data = await s3.getObject(getParams).promise();
        const bookmark = JSON.parse(data.Body.toString());
        bookmarks.push(bookmark);
      } catch (error) {
        console.error(`Error fetching bookmark ${object.Key}:`, error);
      }
    }

    // Generate CSV content
    const csvHeader = 'Title,URL,Timestamp,Favicon,Tags\n';
    const csvRows = bookmarks
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map(bookmark => {
        const title = `"${bookmark.title.replace(/"/g, '""')}"`;
        const url = `"${bookmark.url}"`;
        const timestamp = bookmark.timestamp;
        const favicon = `"${bookmark.favicon || ''}"`;
        const tags = `"${(bookmark.tags || []).join(', ')}"`;
        
        return `${title},${url},${timestamp},${favicon},${tags}`;
      })
      .join('\n');

    const csvContent = csvHeader + csvRows;

    // Set response headers for CSV download
    const fileName = `bookmarks-${userEmail}-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export bookmarks error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// DELETE /api/bookmarks/:id
router.delete('/:id', async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { id } = req.params;

    // List user's bookmarks to find the one with matching ID
    const listParams = {
      Bucket: BUCKET_NAME,
      Prefix: getUserS3Prefix(userEmail)
    };

    const result = await s3.listObjectsV2(listParams).promise();
    
    if (!result.Contents || result.Contents.length === 0) {
      return res.status(404).json({ error: 'Bookmark not found' });
    }

    // Find bookmark with matching ID
    let bookmarkKey = null;
    for (const object of result.Contents) {
      try {
        const getParams = {
          Bucket: BUCKET_NAME,
          Key: object.Key
        };
        
        const data = await s3.getObject(getParams).promise();
        const bookmark = JSON.parse(data.Body.toString());
        
        if (bookmark.id === id) {
          bookmarkKey = object.Key;
          break;
        }
      } catch (error) {
        console.error(`Error checking bookmark ${object.Key}:`, error);
      }
    }

    if (!bookmarkKey) {
      return res.status(404).json({ error: 'Bookmark not found' });
    }

    // Delete bookmark from S3
    const deleteParams = {
      Bucket: BUCKET_NAME,
      Key: bookmarkKey
    };

    await s3.deleteObject(deleteParams).promise();

    res.json({ message: 'Bookmark deleted successfully' });

  } catch (error) {
    console.error('Delete bookmark error:', error);
    res.status(500).json({ error: 'Failed to delete bookmark' });
  }
});

// GET /api/bookmarks/stats
router.get('/stats', async (req, res) => {
  try {
    const userEmail = req.user.email;

    // List user's bookmarks
    const listParams = {
      Bucket: BUCKET_NAME,
      Prefix: getUserS3Prefix(userEmail)
    };

    const result = await s3.listObjectsV2(listParams).promise();
    
    const totalBookmarks = result.Contents ? result.Contents.length : 0;
    const totalSize = result.Contents 
      ? result.Contents.reduce((sum, obj) => sum + (obj.Size || 0), 0)
      : 0;

    // Calculate date range
    let oldestDate = null;
    let newestDate = null;
    
    if (result.Contents && result.Contents.length > 0) {
      const dates = result.Contents.map(obj => new Date(obj.LastModified));
      oldestDate = new Date(Math.min(...dates));
      newestDate = new Date(Math.max(...dates));
    }

    res.json({
      totalBookmarks,
      totalSize,
      oldestBookmark: oldestDate,
      newestBookmark: newestDate,
      userEmail
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

module.exports = router; 