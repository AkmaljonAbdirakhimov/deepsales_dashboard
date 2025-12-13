# Company Creation

## Overview

When a new company is created, **PostgreSQL creates a separate database for each company**.

## PostgreSQL

**Creates a NEW PostgreSQL database for each company**

- Each company gets its own PostgreSQL database
- Database name: `deepsales_analysis_company_{name}_{timestamp}` (with prefix)
- Complete data isolation - each company has its own database instance

**Process:**
1. Company record created in main database
2. New PostgreSQL database created: `CREATE DATABASE deepsales_analysis_company_acme_1234567890`
3. Schema created in that database (managers, audio_files, transcriptions, etc.)
4. Initial data seeded (default categories and criteria)

## How It Works

### PostgreSQL Example

```javascript
// Creates PostgreSQL database: deepsales_analysis_company_acme_1234567890
// (prefix is automatically added)
await createCompanyDatabase('company_acme_1234567890');
```

**Database Structure:**
```
PostgreSQL Server
├── deepsales_analysis (main database)
│   └── companies, users, pricing_plans tables
│
├── deepsales_analysis_company_acme_1234567890 (company database)
│   ├── managers
│   ├── audio_files
│   ├── transcriptions
│   ├── analyses
│   ├── conversation_categories
│   └── conversation_criteria
│
├── deepsales_analysis_company_xyz_1234567891 (company database)
│   ├── managers
│   ├── audio_files
│   └── ...
│
└── deepsales_analysis_company_test_1234567892 (company database)
    ├── managers
    ├── audio_files
    └── ...
```

## Data Isolation

### PostgreSQL
- **Physical isolation**: Separate databases
- Each company's data is in a different database
- No risk of cross-company data access
- Each database has its own connection pool

## Code Implementation

The `createCompanyDatabase()` function creates a new PostgreSQL database:

```javascript
// In companyService.js
await createCompanyDatabase(databaseName, companyId);
//                                    ^^^^^^^^^^^^
//                                    Optional, for logging
```

- Creates new PostgreSQL database
- Connects to it using a dedicated connection pool

## Database Naming

**PostgreSQL:**
- Base name format: `company_{sanitized_name}_{timestamp}` (stored in database)
- Actual database name: `deepsales_analysis_company_{sanitized_name}_{timestamp}` (with prefix)
- Example stored: `company_acme_corp_1234567890`
- Example actual database: `deepsales_analysis_company_acme_corp_1234567890`
- Prefix `deepsales_analysis_` is automatically added when creating/accessing PostgreSQL databases

## Advantages of Separate Databases

✅ **Complete Data Isolation**
- No risk of data leakage between companies
- No need for `company_id` filtering in queries

✅ **Easy Backup/Restore**
- Backup individual company databases
- Restore without affecting other companies

✅ **Easy Deletion**
- Delete company = delete its database
- No orphaned data

✅ **Performance**
- Smaller databases = faster queries
- Better index performance per company

✅ **Connection Pooling**
- Each company database has its own connection pool
- Better resource management

✅ **Scalability**
- Can move company databases to different servers
- Better for large deployments

## Summary

**PostgreSQL creates separate databases for each company.**

This provides complete physical data isolation, making it easy to manage, backup, and scale individual company data independently.