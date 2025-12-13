/**
 * PostgreSQL Migration Script - Company Tables Schema
 * Creates tables for: managers, audio_files, transcriptions, analyses, 
 * conversation_categories, conversation_criteria
 * 
 * Note: This schema is created in each company's separate database
 * (No company_id needed since each company has its own database)
 */

const { createDatabaseInstance } = require('../postgresDatabase');

async function createCompanySchema(databaseName) {
    // Connect to the specific company database
    const db = createDatabaseInstance(databaseName);
    const pool = db.getPool ? db.getPool() : db.pool;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Create managers table (no company_id needed - separate database)
        await client.query(`
            CREATE TABLE IF NOT EXISTS managers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create audio_files table
        await client.query(`
            CREATE TABLE IF NOT EXISTS audio_files (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                original_name VARCHAR(255) NOT NULL,
                upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                manager_id INTEGER REFERENCES managers(id) ON DELETE SET NULL,
                status VARCHAR(50) DEFAULT 'pending'
            )
        `);

        // Create transcriptions table
        await client.query(`
            CREATE TABLE IF NOT EXISTS transcriptions (
                id SERIAL PRIMARY KEY,
                audio_file_id INTEGER NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
                full_text TEXT,
                segments JSONB
            )
        `);

        // Create analyses table
        await client.query(`
            CREATE TABLE IF NOT EXISTS analyses (
                id SERIAL PRIMARY KEY,
                audio_file_id INTEGER NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
                category VARCHAR(255),
                overall_score INTEGER,
                category_scores JSONB,
                criteria_scores JSONB,
                objections JSONB,
                mistakes JSONB,
                mood JSONB,
                feedback TEXT,
                explanation TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create conversation_categories table
        await client.query(`
            CREATE TABLE IF NOT EXISTS conversation_categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create conversation_criteria table
        await client.query(`
            CREATE TABLE IF NOT EXISTS conversation_criteria (
                id SERIAL PRIMARY KEY,
                category_id INTEGER NOT NULL REFERENCES conversation_categories(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes for better performance
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_audio_files_manager_id ON audio_files(manager_id);
            CREATE INDEX IF NOT EXISTS idx_audio_files_status ON audio_files(status);
            CREATE INDEX IF NOT EXISTS idx_transcriptions_audio_file_id ON transcriptions(audio_file_id);
            CREATE INDEX IF NOT EXISTS idx_analyses_audio_file_id ON analyses(audio_file_id);
            CREATE INDEX IF NOT EXISTS idx_criteria_category_id ON conversation_criteria(category_id);
        `);

        await client.query('COMMIT');
        console.log(`Company database schema created successfully: ${databaseName}`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error creating company schema for ${databaseName}:`, error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { createCompanySchema };

// Run if called directly
if (require.main === module) {
    const databaseName = process.argv[2];
    if (!databaseName) {
        console.error('Usage: node createCompanySchema.js <database_name>');
        process.exit(1);
    }

    createCompanySchema(databaseName)
        .then(() => {
            console.log('Migration completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}
