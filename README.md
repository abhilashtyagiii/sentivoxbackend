# 🎯 AI Interview Analysis System

An intelligent interview analysis application that uses **Gemini AI** to process audio files and provide comprehensive analysis including transcription, sentiment analysis, JD relevance scoring, and conversation flow evaluation.

---

## ⚡ SUPER QUICK START (For VSCode Users)

**After unzipping the project, run these 4 commands:**

```bash
npm install                    # Install dependencies
cp .env.example .env          # Create environment file  
# Edit .env file with your Gemini API key
npm run dev                   # Start the application
```

**Then open:** http://localhost:5000

---

## ✨ Features

- **🎵 Audio Upload**: Drag & drop interface for MP3, WAV, M4A files (up to 100MB)
- **🤖 AI Transcription**: Powered by Gemini AI with speaker identification
- **😊 Sentiment Analysis**: Real-time emotional tone analysis for both parties
- **📋 JD Relevance Scoring**: Match candidate responses with job requirements
- **📊 Flow Analysis**: Conversation continuity and structure evaluation
- **📄 PDF Reports**: Detailed analysis reports with recruiter recommendations
- **🎨 Modern UI**: Clean, responsive interface with dark/light mode support
- **🗄️ PostgreSQL Database**: Persistent storage for interviews and analysis results

---

## 🗄️ PostgreSQL Database Setup

This application uses **PostgreSQL** for persistent data storage. All interview data, analysis reports, and metrics are stored in the database.

### 🔧 Database Connection - Replit Environment

If you're running this on **Replit**:

1. **Provision a PostgreSQL Database** (if not already done):
   - Open the **Tools** panel in Replit
   - Click on **Database** 
   - Select **PostgreSQL**
   - Click **Create Database**
   
2. **Database URL is Automatic**:
   - Replit automatically sets the `DATABASE_URL` environment variable
   - You don't need to add it to your `.env` file
   - The application will automatically connect to your database

3. **Push Database Schema**:
   ```bash
   npm run db:push
   ```
   This command creates all necessary tables in your PostgreSQL database.

4. **Verify Connection**:
   ```bash
   # The application will show "Connected to database" when starting
   npm run dev
   ```

### 🏠 Database Connection - Local Development

If you're running this **locally** (outside Replit):

1. **Install PostgreSQL**:
   ```bash
   # macOS (using Homebrew)
   brew install postgresql@16
   brew services start postgresql@16
   
   # Ubuntu/Debian
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   sudo systemctl start postgresql
   
   # Windows
   # Download from: https://www.postgresql.org/download/windows/
   ```

2. **Create Database**:
   ```bash
   # Connect to PostgreSQL
   psql -U postgres
   
   # Create database
   CREATE DATABASE interview_analysis;
   
   # Create user (optional)
   CREATE USER interview_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE interview_analysis TO interview_user;
   
   # Exit
   \q
   ```

3. **Configure Connection**:
   - Edit your `.env` file
   - Uncomment and update the `DATABASE_URL` line:
   ```env
   DATABASE_URL=postgresql://postgres:password@localhost:5432/interview_analysis
   ```
   Or with custom user:
   ```env
   DATABASE_URL=postgresql://interview_user:your_password@localhost:5432/interview_analysis
   ```

4. **Push Database Schema**:
   ```bash
   npm run db:push
   ```

5. **Start Application**:
   ```bash
   npm run dev
   ```

### 📊 Database Schema

The application creates the following tables:

- **users**: User authentication and profiles
- **interviews**: Interview recordings and metadata
- **analysis_reports**: Analysis results and scores
- **recruiter_metrics**: Performance metrics for recruiters
- **pipeline_monitoring**: Processing pipeline status and logs

### 🔍 Database Management Commands

```bash
# Push schema changes to database
npm run db:push

# Force push (if you get warnings about data loss)
npm run db:push --force

# View database in Replit
# Use the Database tab in Replit's Tools panel

# Connect to PostgreSQL directly (local)
psql -U postgres interview_analysis

# View tables
\dt

# View table structure
\d users
\d interviews
\d analysis_reports

# Query data
SELECT * FROM interviews LIMIT 5;
```

### ⚠️ Database Troubleshooting

#### Error: "DATABASE_URL must be set"

**In Replit:**
```bash
# Make sure PostgreSQL database is provisioned
# Check Tools > Database > PostgreSQL
# Restart the application after provisioning
```

**Locally:**
```bash
# Check if DATABASE_URL is in .env
cat .env | grep DATABASE_URL

# Verify PostgreSQL is running
psql -U postgres -c "SELECT version();"

# Test connection string
psql "postgresql://postgres:password@localhost:5432/interview_analysis"
```

#### Error: "Database connection failed"

```bash
# Check PostgreSQL service status (local)
# macOS
brew services list | grep postgresql

# Linux
sudo systemctl status postgresql

# Verify database exists
psql -U postgres -l | grep interview_analysis

# Check connection permissions
psql -U postgres
\du  # List users and their permissions
```

#### Error: "relation does not exist"

```bash
# Push the schema to create tables
npm run db:push

# If tables still missing, force push
npm run db:push --force
```

### 🔒 Database Security

- **Never commit** your `.env` file with real database credentials
- Use **strong passwords** for database users
- In production, use **SSL connections** and enable row-level security
- Regularly **backup your database**:
  ```bash
  # Local backup
  pg_dump interview_analysis > backup.sql
  
  # Restore from backup
  psql interview_analysis < backup.sql
  ```

---

## 🚀 Complete Setup Guide (Small to Big Commands)

### 📋 Prerequisites

- **Node.js 18+** or **Node.js 20+**
- **npm** package manager
- **VSCode** (recommended editor)
- **Gemini API Key** (free from [ai.google.dev](https://ai.google.dev/))

---

## 🔥 ESSENTIAL COMMANDS (Copy & Paste These!)

### Step 1: Basic Setup (After Unzipping)

```bash
# Navigate to project directory (if not already there)
cd interview-analysis

# Check if Node.js is installed
node --version

# Check if npm is installed  
npm --version

# Install all dependencies (THIS IS CRUCIAL!)
npm install
```

### Step 2: Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# For Windows users:
copy .env.example .env
```

**Then edit `.env` file with your API key:**
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
NODE_ENV=development
PORT=5000
```

### Step 3: Start the Application

```bash
# Single command to run everything
npm run dev

# Application will open at: http://localhost:5000
```

---

## 🎯 DETAILED COMMANDS (Step by Step)

### A. First Time Setup Commands

```bash
# 1. Check system requirements
node --version              # Should show v18+ or v20+
npm --version               # Should show 8+ or higher

# 2. Clean install (if having issues)
rm -rf node_modules package-lock.json
npm install

# 3. Verify installation
npm list --depth=0          # Shows installed packages

# 4. Check TypeScript
npx tsc --version           # Should show TypeScript version
```

### B. Environment Setup Commands

```bash
# Create environment file
cp .env.example .env

# View the template
cat .env.example

# Edit environment file (choose one):
nano .env                   # Terminal editor
code .env                   # VSCode editor
vi .env                     # Vi editor

# Verify environment variables
cat .env                    # Display current .env file
```

### C. Development Commands

```bash
# Start development server (MAIN COMMAND)
npm run dev

# Alternative: Start with detailed logs
NODE_ENV=development npm run dev

# Start in background (if needed)
nohup npm run dev &

# Check if server is running
curl http://localhost:5000  # Should return HTML
```

### D. Verification Commands

```bash
# Check if application is running
curl -I http://localhost:5000               # Check HTTP status
lsof -i :5000                              # Check what's using port 5000
ps aux | grep node                         # Check Node.js processes

# Test API endpoints
curl http://localhost:5000/api/health      # Health check (if available)
curl -X GET http://localhost:5000/api/     # API test
```

---

## 🛠️ TROUBLESHOOTING COMMANDS

### Common Issue 1: Port Already in Use

```bash
# Find what's using port 5000
lsof -i :5000
netstat -tulpn | grep :5000

# Kill process using port 5000
sudo kill -9 $(lsof -t -i:5000)

# Alternative: Use different port
PORT=3000 npm run dev
```

### Common Issue 2: Node/NPM Issues

```bash
# Clear npm cache
npm cache clean --force

# Reinstall Node modules
rm -rf node_modules package-lock.json
npm install

# Check npm configuration
npm config list
npm doctor                  # Diagnose npm issues
```

### Common Issue 3: Permission Issues

```bash
# Fix npm permissions (if needed)
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) ./node_modules

# Make uploads directory writable
mkdir -p uploads
chmod 755 uploads
```

### Common Issue 4: Environment Variables Not Loading

```bash
# Check if .env file exists
ls -la | grep .env

# Display .env content (without sensitive data)
cat .env | grep -v "API_KEY"

# Test environment loading
node -e "require('dotenv').config(); console.log(process.env.NODE_ENV);"
```

---

## 🚀 QUICK START (Copy This Block!)

```bash
# Complete setup in one go:
cd interview-analysis
npm install
cp .env.example .env
echo "Now edit .env with your Gemini API key, then run:"
echo "npm run dev"
```

### Manual Steps After Above Commands:
1. **Edit `.env` file** - Add your Gemini API key
2. **Run** `npm run dev` 
3. **Open** http://localhost:5000 in browser

---

## 🔧 ADVANCED COMMANDS

### Development Workflow

```bash
# Start development with auto-restart
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run TypeScript checker
npm run check

# Database operations
npm run db:push             # Push schema changes
```

### Debugging Commands

```bash
# Start with debugging
DEBUG=* npm run dev

# View detailed logs
npm run dev 2>&1 | tee app.log

# Monitor file changes
npx nodemon server/index.ts

# Check application health
curl -f http://localhost:5000 || echo "Server not responding"
```

### Performance & Monitoring

```bash
# Check memory usage
ps -o pid,ppid,cmd,%mem,%cpu -p $(pgrep -f node)

# Monitor logs in real-time
tail -f app.log

# Check disk space
df -h
du -sh node_modules/       # Check dependencies size
```

---

## 🆘 EMERGENCY RESET COMMANDS

```bash
# Nuclear option - complete reset
rm -rf node_modules package-lock.json .env
cp .env.example .env
npm install
# Then edit .env and run: npm run dev
```

---

## 📱 VSCode Integration Commands

```bash
# Open project in VSCode
code .

# Install recommended extensions
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension bradlc.vscode-tailwindcss
code --install-extension esbenp.prettier-vscode

# Open integrated terminal in VSCode: Ctrl+` (backtick)
```

## 🔧 Development Commands

### Available NPM Scripts
```bash
# Development
npm run dev              # Start both frontend and backend (MAIN COMMAND)

# Production
npm run build            # Build entire application
npm start                # Start production server

# Utilities  
npm run check            # Run TypeScript checker
npm run db:push          # Push database schema changes
```

## 📁 Project Structure

```
interview-analysis/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Utilities
│   │   └── hooks/         # Custom hooks
├── server/                # Express backend
│   ├── services/          # AI and analysis services
│   ├── routes.ts         # API routes
│   └── storage.ts        # Data storage
├── shared/               # Shared types and schemas
└── uploads/              # Audio file storage
```

## 🔑 API Key Setup

### Get Your Free Gemini API Key:

1. **Visit**: [ai.google.dev](https://ai.google.dev/)
2. **Click**: "Get API key"
3. **Sign in** with your Google account
4. **Create** a new API key
5. **Copy** the key to your `.env` file

### Rate Limits:
- **Free Tier**: 2 requests per minute
- **Paid Tier**: Higher limits available

## 🚦 Usage

### 1. Upload Audio File
- Drag & drop or browse for audio files
- Supported formats: MP3, WAV, M4A (up to 100MB)

### 2. Add Job Description
- Paste the job description for relevance analysis
- This helps match candidate responses to requirements

### 3. Start Analysis
- Click "Analyze" to begin processing
- Real-time progress tracking through 6 stages:
  - Audio Processing
  - Content Classification
  - Sentiment Analysis
  - JD Relevance Analysis
  - Flow Analysis
  - Report Generation

### 4. View Results
- **Metrics Dashboard**: Key scores and insights
- **Sentiment Charts**: Emotional tone over time
- **Relevance Breakdown**: Skills and experience matching
- **Conversation Analysis**: Question-answer patterns

### 5. Download PDF Report
- Comprehensive analysis report
- Recruiter recommendations included
- Professional formatting for sharing

## 📋 Application-Specific Issues

### API & Application Errors:

#### "Rate limit exceeded" error
```bash
# Solution: Wait 1 minute or use a new API key
# The free tier allows 2 requests per minute
```

#### "GEMINI_API_KEY not found"
```bash
# Check your .env file exists and contains:
GEMINI_API_KEY=your_actual_api_key_here

# Restart the application after adding the key:
npm run dev
```

#### "File upload failed"
```bash
# Check file size (must be under 100MB)
# Check file format (MP3, WAV, M4A only)
# Ensure uploads/ directory has write permissions
chmod 755 uploads/
```

## 🔧 Configuration

### Environment Variables:
```env
# Required
GEMINI_API_KEY=your_key_here

# Optional
NODE_ENV=development          # development/production
PORT=5000                    # Server port
DATABASE_URL=postgresql://   # Database connection
SESSION_SECRET=random_secret # Session encryption
```

### Customization:
- **Colors**: Edit `client/src/index.css`
- **API Models**: Modify `server/services/gemini.ts`
- **UI Components**: Update files in `client/src/components/`

## 📦 Dependencies

See [dependencies.md](./dependencies.md) for a complete list of packages and their purposes.

## 🤝 Support

### Need Help?
1. **Check** this README for common solutions
2. **Review** the [dependencies.md](./dependencies.md) file
3. **Verify** your environment setup
4. **Test** with a small audio file first

### Error Logs:
```bash
# Check application logs
npm run dev

# View detailed error messages in the terminal
```

---

**Built with ❤️ using React, Express, TypeScript, and Gemini AI**