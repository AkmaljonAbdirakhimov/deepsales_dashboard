# PostgreSQL Setup Guide

This guide explains how to set up PostgreSQL for a fresh installation.

## Prerequisites

1. PostgreSQL installed and running (version 12+)
2. Node.js dependencies installed (`npm install` in backend directory)

## Step 1: Install PostgreSQL

### macOS
```bash
brew install postgresql
brew services start postgresql
```

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Windows
Download and install from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)

## Step 2: Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create main database
CREATE DATABASE deepsales_analysis;

# Create user (optional, or use default postgres user)
CREATE USER deepsales_analysis_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE deepsales_analysis TO deepsales_analysis_user;

# Exit psql
\q
```

## Step 3: Configure Environment Variables

Add these to your `.env` file in the `backend` directory:

```env
# Database Configuration
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=deepsales_analysis
DB_USER=postgres
# or DB_USER=deepsales_analysis_user if you created a custom user
DB_PASSWORD=your_password

# Alternative: Use connection string
# DATABASE_URL=postgresql://user:password@localhost:5432/deepsales_analysis
```

## Step 4: Run Schema Migrations

```bash
cd backend

# Create main database schema
node database/migrations/createMainSchema.js

# Company schemas will be created automatically when companies are created
# No need to run createCompanySchema.js manually
```

## Step 5: Start the Server

```bash
# Start the server
node server.js

# The server will automatically:
# - Connect to PostgreSQL
# - Create schemas if they don't exist
# - Seed initial data (super admin, pricing plans)
```

## Step 6: Verify Setup

1. Check that the server starts without errors
2. Test creating a company (it will automatically create a PostgreSQL database for that company)
3. Verify data is being stored correctly

## Troubleshooting

### Connection Issues
- Verify PostgreSQL is running: `pg_isready` or `sudo systemctl status postgresql`
- Check connection credentials in `.env`
- Verify database exists: `psql -U postgres -l`

### Permission Issues
- Ensure database user has proper permissions
- Check PostgreSQL logs: `/var/log/postgresql/` (Linux) or `brew services list` (macOS)

### Schema Creation Errors
- Ensure PostgreSQL schema was created successfully
- Check that the main database exists
- Verify environment variables are set correctly

## Database Structure

### Main Database: `deepsales_analysis`
- `pricing_plans` - Subscription plans
- `companies` - Company records
- `users` - User accounts (super admin and company users)

### Company Databases: `deepsales_analysis_company_*`
Each company gets its own PostgreSQL database with:
- `managers` - Sales managers
- `audio_files` - Uploaded audio files
- `transcriptions` - Audio transcriptions
- `analyses` - Analysis results
- `conversation_categories` - Conversation categories
- `conversation_criteria` - Evaluation criteria

## Notes

- Company databases are created automatically when you create a company
- All company databases use the prefix `deepsales_analysis_`
- Each company database is completely isolated
- JSON fields are stored as JSONB for better performance

## Support

If you encounter issues:
1. Check PostgreSQL logs
2. Verify all environment variables are set correctly
3. Ensure PostgreSQL is running and accessible
4. Test with a simple connection first

