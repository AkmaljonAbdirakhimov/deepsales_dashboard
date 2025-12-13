# Database Layer

This directory contains the database abstraction layer for PostgreSQL.

## Architecture

### PostgreSQL
- **Main Database**: Contains tables for `pricing_plans`, `companies`, and `users`
- **Company Databases**: Separate PostgreSQL database per company
  - Each company gets its own isolated database
  - Tables: `managers`, `audio_files`, `transcriptions`, `analyses`, `conversation_categories`, `conversation_criteria`
- **JSON Storage**: Uses JSONB for better query performance
- **Connection Pooling**: Automatic connection management

## Files

- `mainDatabase.js` - Main database initialization (users, companies, pricing plans)
- `companyDatabase.js` - Company-specific database operations
- `postgresDatabase.js` - PostgreSQL connection and query wrapper
- `migrations/` - Database schema and data migration scripts

## Usage

### PostgreSQL Configuration
Set environment variables in `.env`:
```env
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=deepsales_analysis
DB_USER=postgres
DB_PASSWORD=your_password
```

Or use connection string:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/deepsales_analysis
```

## API

The database layer provides a consistent API:

```javascript
// Get single row
const user = await db.get('SELECT * FROM users WHERE id = $1', userId);

// Get multiple rows
const files = await db.all('SELECT * FROM audio_files WHERE manager_id = $1', managerId);

// Insert/Update/Delete
const result = await db.run('INSERT INTO managers (name) VALUES ($1)', managerName);
const newId = result.lastID; // Get inserted ID
```

## Features

### Automatic Query Conversion
- `?` placeholders automatically converted to PostgreSQL `$1, $2, ...` format
- JSONB fields automatically converted to strings for consistency

### Company Data Isolation
- **PostgreSQL**: Separate database per company (physical isolation)
- Each company database has its own connection pool

### Connection Management
- Connection pooling (max 20 connections per database)
- Automatic connection management and cleanup

## Notes

- JSON fields are stored as JSONB in PostgreSQL
- The wrapper automatically converts JSONB to strings for consistency
- Each company-specific database is created with a prefix: `deepsales_analysis_{database_name}`