# Bookmark Synchronizer - Setup Guide
## User Authentication System

### Overview
This guide will help you set up the complete Bookmark Synchronizer system with user authentication, including the backend API server, PostgreSQL database, and Chrome extension.

---

## Prerequisites

### Required Software
- **Node.js** 18+ and npm
- **PostgreSQL** 14+ (local or AWS RDS)
- **AWS Account** (for S3 bucket)
- **Chrome Browser** (for extension)

### Required Services
- **AWS RDS PostgreSQL** instance
- **AWS S3** bucket
- **Domain/Server** for API deployment (AWS EC2, Heroku, etc.)

---

## 1. Database Setup (PostgreSQL)

### Option A: AWS RDS (Recommended for Production)

1. **Create RDS Instance**
   ```bash
   # Using AWS CLI
   aws rds create-db-instance \
     --db-instance-identifier bookmark-sync-db \
     --db-instance-class db.t3.micro \
     --engine postgres \
     --master-username admin \
     --master-user-password your-secure-password \
     --allocated-storage 20 \
     --vpc-security-group-ids sg-xxxxxxxxx
   ```

2. **Configure Security Groups**
   - Allow inbound connections on port 5432
   - Restrict access to your server's IP address

3. **Note Connection Details**
   ```
   Host: bookmark-sync-db.xxxxxxxxx.us-east-1.rds.amazonaws.com
   Port: 5432
   Database: postgres
   Username: admin
   Password: your-secure-password
   ```

### Option B: Local PostgreSQL

1. **Install PostgreSQL**
   ```bash
   # macOS
   brew install postgresql
   brew services start postgresql
   
   # Ubuntu
   sudo apt-get install postgresql postgresql-contrib
   sudo systemctl start postgresql
   ```

2. **Create Database**
   ```bash
   sudo -u postgres psql
   CREATE DATABASE bookmark_sync;
   CREATE USER bookmark_user WITH PASSWORD 'your-password';
   GRANT ALL PRIVILEGES ON DATABASE bookmark_sync TO bookmark_user;
   \q
   ```

---

## 2. AWS S3 Setup

### Create S3 Bucket
```bash
# Using AWS CLI
aws s3 mb s3://bookmark-sync-bucket-unique-name
```

### Configure CORS Policy
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": []
    }
]
```

### Create IAM User for API
1. Create IAM user: `bookmark-sync-api`
2. Attach custom policy:

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
                "arn:aws:s3:::bookmark-sync-bucket-unique-name",
                "arn:aws:s3:::bookmark-sync-bucket-unique-name/*"
            ]
        }
    ]
}
```

3. Save Access Key ID and Secret Access Key

---

## 3. Backend API Setup

### Clone and Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment template
cp env.example .env
```

### Configure Environment Variables
Edit `.env` file:

```env
# Database Configuration
DB_HOST=your-rds-endpoint.region.rds.amazonaws.com
DB_PORT=5432
DB_NAME=bookmark_sync
DB_USER=admin
DB_PASSWORD=your-secure-password

# JWT Configuration (generate secure keys)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=different-refresh-token-secret-also-32-chars
REFRESH_TOKEN_EXPIRES_IN=7d

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key-id-here
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key-here
S3_BUCKET_NAME=bookmark-sync-bucket-unique-name

# Server Configuration
PORT=3000
NODE_ENV=production
```

### Generate Secure JWT Secrets
```bash
# Generate secure random strings
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Database Migration
```bash
# Start the server to auto-create tables
npm start

# Or run manual migration
npm run migrate
```

### Start the API Server
```bash
# Production
npm start

# Development with auto-reload
npm run dev
```

### Verify API is Running
```bash
curl http://your-server-domain:3000/health
# Should return: {"status":"OK","timestamp":"...","version":"1.0.0"}
```

---

## 4. Deployment Options

### Option A: AWS EC2

1. **Launch EC2 Instance**
   - Amazon Linux 2 or Ubuntu
   - t2.micro (free tier eligible)
   - Security group allowing HTTP (80), HTTPS (443), SSH (22)

2. **Setup Server**
   ```bash
   # Connect via SSH
   ssh -i your-key.pem ec2-user@your-ec2-ip
   
   # Install Node.js
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   source ~/.bashrc
   nvm install 18
   
   # Clone and setup your project
   git clone your-repo-url
   cd bookmark-sync-api
   npm install --production
   
   # Install PM2 for process management
   npm install -g pm2
   pm2 start server.js --name bookmark-api
   pm2 startup
   pm2 save
   ```

3. **Setup Nginx (Optional)**
   ```bash
   sudo yum install nginx
   # Configure proxy to your Node.js app
   ```

### Option B: Heroku

1. **Install Heroku CLI**
2. **Deploy**
   ```bash
   heroku create your-bookmark-api
   heroku config:set DB_HOST=your-rds-endpoint
   heroku config:set DB_USER=admin
   # ... set all environment variables
   git push heroku main
   ```

### Option C: Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 5. Chrome Extension Setup

### Update Manifest (if needed)
The `manifest.json` should already be configured for the new system.

### Load Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the extension directory

### Configure API Server
1. Right-click the extension icon
2. Select "🔐 Login / Sign Up"
3. Enter your API server URL (e.g., `https://your-domain.com`)
4. Create an account or login

---

## 6. Usage Instructions

### First-Time Setup
1. **Install Extension** (as above)
2. **Right-click extension icon** → "🔐 Login / Sign Up"
3. **Enter API server URL**
4. **Create account** with email and strong password
5. **Start bookmarking** by clicking the extension icon

### Daily Usage
- **Save bookmark**: Click extension icon on any webpage
- **View bookmarks**: Right-click icon → "📖 View Bookmarks"
- **Search bookmarks**: Use search in bookmark viewer
- **Export to CSV**: Available in bookmark viewer
- **Logout**: Right-click icon → "🚪 Logout"

---

## 7. Troubleshooting

### Common Issues

#### "Connection failed" Error
- Check API server URL is correct
- Verify server is running: `curl http://your-domain/health`
- Check CORS configuration

#### "Authentication expired" Error
- Tokens automatically refresh
- If persistent, logout and login again
- Check JWT secrets are consistent

#### Bookmark Not Saving
- Verify AWS credentials in server environment
- Check S3 bucket permissions
- Look at server logs for errors

#### Database Connection Failed
- Verify database credentials
- Check security group allows connections
- Ensure database exists

### Server Logs
```bash
# Check server logs
pm2 logs bookmark-api

# Or if running directly
npm run dev
```

### Extension Debugging
1. Right-click extension icon → "Inspect popup"
2. Check console for errors
3. Go to `chrome://extensions/` → Click "Background page"

---

## 8. Security Considerations

### Production Checklist
- [ ] Use HTTPS for API server
- [ ] Strong JWT secrets (32+ characters)
- [ ] Database credentials secure
- [ ] S3 bucket not publicly accessible
- [ ] Rate limiting enabled
- [ ] Regular security updates

### Best Practices
- Rotate JWT secrets periodically
- Monitor API usage
- Regular database backups
- Use environment variables for secrets
- Enable AWS CloudTrail for audit logging

---

## 9. Scaling and Performance

### Database Optimization
```sql
-- Add indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_last_login ON users(last_login);
```

### API Performance
- Use Redis for session storage
- Implement caching for frequently accessed data
- Setup CloudFront for S3 assets
- Use database connection pooling

### Monitoring
- Setup health checks
- Monitor API response times
- Track database performance
- Setup alerts for errors

---

## 10. Backup and Recovery

### Database Backup
```bash
# Automated daily backups
pg_dump -h your-rds-endpoint -U admin bookmark_sync > backup_$(date +%Y%m%d).sql
```

### S3 Backup
- Enable S3 versioning
- Setup cross-region replication
- Regular backup validation

---

## Support

For issues and questions:
- Check the troubleshooting section
- Review server logs
- Submit issues on GitHub repository
- Email support: support@your-domain.com

---

**Note**: Replace placeholder values (your-domain.com, AWS credentials, etc.) with your actual configuration values. 