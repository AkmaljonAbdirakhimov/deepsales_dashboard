/**
 * PostgreSQL Migration Script - Main Database Schema
 * Creates tables for: pricing_plans, companies, users
 */

const { getPostgresPool } = require('../postgresDatabase');

async function createMainSchema() {
    const pool = getPostgresPool();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Create pricing_plans table
        await client.query(`
            CREATE TABLE IF NOT EXISTS pricing_plans (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                description TEXT,
                price DECIMAL(10, 2) NOT NULL,
                max_managers INTEGER NOT NULL,
                hours_per_manager DECIMAL(10, 2) NOT NULL,
                price_per_manager DECIMAL(10, 2) NOT NULL,
                price_per_hour DECIMAL(10, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);



        // Create companies table
        await client.query(`
            CREATE TABLE IF NOT EXISTS companies (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                database_name VARCHAR(255) NOT NULL UNIQUE,
                plan_id INTEGER REFERENCES pricing_plans(id) ON DELETE SET NULL,
                extra_managers INTEGER DEFAULT 0,
                extra_hours DECIMAL(10, 2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role VARCHAR(50) NOT NULL CHECK(role IN ('super_admin', 'company')),
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
            CREATE INDEX IF NOT EXISTS idx_companies_database_name ON companies(database_name);
            CREATE INDEX IF NOT EXISTS idx_companies_plan_id ON companies(plan_id);
        `);

        await client.query('COMMIT');
        console.log('Main database schema created successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating main schema:', error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { createMainSchema };

// Run if called directly
if (require.main === module) {
    createMainSchema()
        .then(() => {
            console.log('Migration completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

