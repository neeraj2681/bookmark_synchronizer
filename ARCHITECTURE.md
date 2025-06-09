# Bookmark Synchronizer - Updated Architecture
## User Authentication System with PostgreSQL Backend

### Overview
The Bookmark Synchronizer has been updated to use a user account system with email/password authentication instead of direct AWS S3 credentials. This provides better security, user management, and organized bookmark storage.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERACTIONS                        │
├─────────────────────┬─────────────────────┬─────────────────┤
│   Left-Click Icon   │  Right-Click Menu   │   Bookmark UI   │
│   (Save Bookmark)   │   (Settings/View)   │   (Search/Browse)│
└─────────────────────┴─────────────────────┴─────────────────┘
           │                      │                      │
           ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                 CHROME EXTENSION LAYER                      │
├─────────────────────┬─────────────────────┬─────────────────┤
│   Background.js     │    Auth.html/js     │  Bookmarks.html │
│   (Service Worker)  │   (Login/Signup)    │   (Viewer/CSV)  │
│   • Event Handler   │   • User Auth       │   • Search UI   │
│   • API Calls       │   • Session Mgmt    │   • Export Tools│
│   • Badge Updates   │   • Validation      │   • Filtering   │
└─────────────────────┴─────────────────────┴─────────────────┘
           │                      │                      │
           ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   API BACKEND LAYER                         │
├─────────────────────┬─────────────────────┬─────────────────┤
│   Express Server    │   JWT Authentication│   S3 Integration│
│   • User Routes     │   • Token Validation│   • File Upload │
│   • Bookmark CRUD   │   • Password Hash   │   • User Folders│
│   • Session Mgmt    │   • Login/Signup    │   • Organized   │
└─────────────────────┴─────────────────────┴─────────────────┘
           │                      │                      │
           ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   STORAGE LAYER                             │
├─────────────────────┬─────────────────────┬─────────────────┤
│   PostgreSQL RDS    │      AWS S3         │   Chrome Storage│
│   • User Accounts   │   • /users/{email}/ │   • JWT Token   │
│   • Hashed Passwords│   • Bookmark Files  │   • Session Data│
│   • User Metadata   │   • User Organized  │   • Local Cache │
└─────────────────────┴─────────────────────┴─────────────────┘
```

---

## Database Schema

### PostgreSQL Tables

#### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

#### Sessions Table (Optional - for refresh tokens)
```sql
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(512) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_refresh_token ON user_sessions(refresh_token);
```

---

## S3 Bucket Organization

### New Structure with User-Based Folders
```
s3://bookmark-sync-bucket/
├── users/
│   ├── user1@example.com/
│   │   ├── bookmarks/
│   │   │   ├── 1703123456789-my-bookmark-title.json
│   │   │   ├── 1703123567890-another-bookmark.json
│   │   │   └── ...
│   │   └── exports/
│   │       ├── bookmarks-export-2024-01-15.csv
│   │       └── ...
│   ├── user2@example.com/
│   │   ├── bookmarks/
│   │   │   └── ...
│   │   └── exports/
│   │       └── ...
│   └── ...
```

---

## API Endpoints

### Authentication Endpoints
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
GET  /api/auth/profile
```

### Bookmark Endpoints
```
POST /api/bookmarks/save
GET  /api/bookmarks/list
GET  /api/bookmarks/search?q={query}
GET  /api/bookmarks/export/csv
DELETE /api/bookmarks/{id}
```

---

## Authentication Flow

### Registration Process
1. User enters email and password in extension
2. Extension sends credentials to API
3. API validates email format and password strength
4. Password is hashed using bcrypt (12 rounds)
5. User record created in PostgreSQL
6. JWT token returned to extension
7. Token stored in Chrome secure storage

### Login Process
1. User enters credentials
2. API validates credentials against database
3. Password verified using bcrypt
4. JWT token generated and returned
5. Token stored in extension for API calls

### Bookmark Save Process
1. User clicks extension icon
2. Extension checks for valid JWT token
3. If token valid, bookmark data sent to API
4. API validates token and extracts user email
5. Bookmark saved to S3 under user's folder
6. Success/failure returned to extension

---

## Security Features

### Password Security
- **Hashing**: bcrypt with 12 rounds
- **Validation**: Minimum 8 characters, complexity requirements
- **Storage**: Only hashed passwords stored in database

### Token Security
- **JWT**: Short-lived access tokens (15 minutes)
- **Refresh Tokens**: Longer-lived tokens for token renewal
- **Storage**: Secure Chrome storage encryption
- **Validation**: Token signature verification on each request

### API Security
- **HTTPS Only**: All communications encrypted
- **CORS**: Restricted to extension origin
- **Rate Limiting**: Prevent brute force attacks
- **Input Validation**: Comprehensive request validation

---

## Tech Stack

### Backend API
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 14+ (AWS RDS)
- **Authentication**: JWT + bcrypt
- **Cloud Storage**: AWS S3
- **Deployment**: AWS EC2 or Elastic Beanstalk

### Required NPM Packages
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "sequelize": "^6.35.0",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "aws-sdk": "^2.1490.0",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "joi": "^17.11.0",
    "dotenv": "^16.3.1"
  }
}
```

### Environment Variables
```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname
DB_HOST=your-rds-endpoint
DB_PORT=5432
DB_NAME=bookmark_sync
DB_USER=your-db-user
DB_PASSWORD=your-db-password

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
S3_BUCKET_NAME=bookmark-sync-bucket

# Server
PORT=3000
NODE_ENV=production
```

---

## Migration Path

### For Existing Users
1. **Data Backup**: Export existing bookmarks from S3
2. **Account Creation**: Prompt users to create accounts
3. **Data Migration**: Move bookmarks to new user-specific folders
4. **Extension Update**: Update to new authentication system

### Migration Script
```javascript
// Migrate existing bookmarks to user-specific folders
// This would be run once during the transition
async function migrateBookmarks(userEmail, oldS3Prefix) {
  // 1. List all bookmarks from old structure
  // 2. Copy to new user-specific folder
  // 3. Update references
  // 4. Clean up old structure
}
```

---

## Benefits of New Architecture

### User Management
- **Multi-User Support**: Multiple users can use the service
- **User Isolation**: Each user's bookmarks are private
- **Account Management**: Users can manage their accounts

### Security Improvements
- **No AWS Credential Exposure**: Users don't need AWS credentials
- **Centralized Authentication**: Secure token-based authentication
- **Access Control**: Fine-grained permission management

### Scalability
- **User Growth**: Easily support thousands of users
- **Resource Management**: Efficient resource allocation per user
- **Monitoring**: Better usage analytics and monitoring

### Maintenance
- **Centralized Updates**: Backend can be updated without extension changes
- **Feature Rollouts**: Gradual feature deployment
- **Support**: Better user support capabilities

---

## Performance Considerations

### Database Optimization
- **Indexing**: Proper indexes on frequently queried columns
- **Connection Pooling**: Efficient database connections
- **Query Optimization**: Optimized SQL queries

### S3 Optimization
- **Batch Operations**: Bulk upload/download when possible
- **CDN**: CloudFront for faster bookmark retrieval
- **Compression**: Gzip compression for larger files

### Caching Strategy
- **JWT Verification**: Cache public keys for token verification
- **User Sessions**: Redis for session management
- **Bookmark Metadata**: Cache frequently accessed bookmarks

---

This updated architecture provides a robust, scalable, and secure foundation for the bookmark synchronization service while maintaining the simplicity of the user experience. 