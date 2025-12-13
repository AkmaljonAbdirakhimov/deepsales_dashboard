const { Pool } = require('pg');
require('dotenv').config();

let pool;

/**
 * Initialize PostgreSQL connection pool
 */
function initializePostgresPool() {
    if (pool) {
        return pool;
    }

    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'deepsales_analysis',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    };

    pool = new Pool(config);

    // Handle pool errors
    pool.on('error', (err) => {
        console.error('Unexpected error on idle PostgreSQL client', err);
    });

    console.log('PostgreSQL connection pool initialized');
    return pool;
}

/**
 * Get PostgreSQL pool instance
 */
function getPostgresPool() {
    if (!pool) {
        return initializePostgresPool();
    }
    return pool;
}

/**
 * Database wrapper for PostgreSQL
 * Provides a consistent API with db.get(), db.all(), db.run() methods
 */
class PostgresDatabase {
    constructor(pool) {
        this.pool = pool;
    }

    /**
     * Get the pool (for closing connections)
     */
    getPool() {
        return this.pool;
    }

    /**
     * Execute a query and return a single row
     * Converts JSONB fields to strings for consistency
     */
    async get(query, ...params) {
        const client = await this.pool.connect();
        try {
            // Convert ? parameter placeholders to PostgreSQL format ($1, $2, ...)
            const pgQuery = this.convertQuery(query, params);
            const result = await client.query(pgQuery.query, pgQuery.params);
            const row = result.rows[0] || null;
            // Convert JSONB fields to strings for consistency
            return this.convertJsonbFields(row);
        } finally {
            client.release();
        }
    }

    /**
     * Execute a query and return all rows
     * Converts JSONB fields to strings for consistency
     */
    async all(query, ...params) {
        const client = await this.pool.connect();
        try {
            const pgQuery = this.convertQuery(query, params);
            const result = await client.query(pgQuery.query, pgQuery.params);
            // Convert JSONB fields to strings for consistency
            return result.rows.map(row => this.convertJsonbFields(row));
        } finally {
            client.release();
        }
    }

    /**
     * Execute a query (INSERT, UPDATE, DELETE)
     * Returns an object with lastID (for INSERT) and changes (for UPDATE/DELETE)
     */
    async run(query, ...params) {
        const client = await this.pool.connect();
        try {
            let pgQuery = this.convertQuery(query, params);

            // For INSERT queries, add RETURNING id if not present
            let lastID = null;
            if (query.trim().toUpperCase().startsWith('INSERT')) {
                const queryUpper = query.toUpperCase();
                if (!queryUpper.includes('RETURNING')) {
                    // Add RETURNING id clause
                    pgQuery.query = pgQuery.query.replace(/;?\s*$/, '') + ' RETURNING id';
                }

                const result = await client.query(pgQuery.query, pgQuery.params);

                if (result.rows.length > 0 && result.rows[0].id) {
                    lastID = parseInt(result.rows[0].id);
                }

                return {
                    lastID: lastID,
                    changes: result.rowCount || 0
                };
            } else {
                // For UPDATE/DELETE, just execute
                const result = await client.query(pgQuery.query, pgQuery.params);
                return {
                    lastID: null,
                    changes: result.rowCount || 0
                };
            }
        } finally {
            client.release();
        }
    }

    /**
     * Execute multiple queries in a transaction
     * Executes PostgreSQL statements separated by semicolons
     */
    async exec(sql) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // Split by semicolon and execute each statement
            const statements = sql.split(';').filter(s => s.trim().length > 0);
            for (const statement of statements) {
                const trimmed = statement.trim();
                // Skip transaction control statements as we handle them above
                if (trimmed &&
                    !trimmed.match(/^\s*BEGIN\s*$/i) &&
                    !trimmed.match(/^\s*COMMIT\s*$/i) &&
                    !trimmed.match(/^\s*ROLLBACK\s*$/i)) {
                    await client.query(trimmed);
                }
            }
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Begin a transaction (for manual transaction control)
     * Returns a transaction client that must be committed or rolled back
     * @returns {Promise<Object>} Transaction client with commit/rollback methods
     */
    async beginTransaction() {
        const client = await this.pool.connect();
        await client.query('BEGIN');
        return {
            client,
            commit: async () => {
                try {
                    await client.query('COMMIT');
                } finally {
                    client.release();
                }
            },
            rollback: async () => {
                try {
                    await client.query('ROLLBACK');
                } finally {
                    client.release();
                }
            },
            query: async (query, ...params) => {
                const pgQuery = this.convertQuery(query, params);
                return await client.query(pgQuery.query, pgQuery.params);
            },
            get: async (query, ...params) => {
                const pgQuery = this.convertQuery(query, params);
                const result = await client.query(pgQuery.query, pgQuery.params);
                const row = result.rows[0] || null;
                return this.convertJsonbFields(row);
            },
            all: async (query, ...params) => {
                const pgQuery = this.convertQuery(query, params);
                const result = await client.query(pgQuery.query, pgQuery.params);
                return result.rows.map(row => this.convertJsonbFields(row));
            },
            run: async (query, ...params) => {
                let pgQuery = this.convertQuery(query, params);
                let lastID = null;
                if (query.trim().toUpperCase().startsWith('INSERT')) {
                    const queryUpper = query.toUpperCase();
                    if (!queryUpper.includes('RETURNING')) {
                        pgQuery.query = pgQuery.query.replace(/;?\s*$/, '') + ' RETURNING id';
                    }
                    const result = await client.query(pgQuery.query, pgQuery.params);
                    if (result.rows.length > 0 && result.rows[0].id) {
                        lastID = parseInt(result.rows[0].id);
                    }
                    return {
                        lastID: lastID,
                        changes: result.rowCount || 0
                    };
                } else {
                    const result = await client.query(pgQuery.query, pgQuery.params);
                    return {
                        lastID: null,
                        changes: result.rowCount || 0
                    };
                }
            }
        };
    }

    /**
     * Close the database connection (for compatibility, but pool manages connections)
     */
    async close() {
        // Pool manages connections, so we don't close individual connections
        // This is here for API compatibility
    }

    /**
     * Convert query placeholders to PostgreSQL format
     * Converts ? placeholders to $1, $2, etc.
     */
    convertQuery(query, params) {
        // Ensure params is an array
        // If params is undefined or null, use empty array
        // If params is already an array, use it
        // Otherwise, wrap it in an array
        let paramsArray;
        if (params === undefined || params === null) {
            paramsArray = [];
        } else if (Array.isArray(params)) {
            paramsArray = params;
        } else {
            paramsArray = [params];
        }

        // Count placeholders in query
        const placeholderCount = (query.match(/\?/g) || []).length;

        // Validate parameter count matches placeholder count
        if (placeholderCount !== paramsArray.length) {
            throw new Error(
                `Parameter count mismatch: Query has ${placeholderCount} placeholders (?) but ${paramsArray.length} parameters provided. ` +
                `Query: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}, ` +
                `Params: ${JSON.stringify(paramsArray)}`
            );
        }

        let paramIndex = 1;
        const convertedParams = [];
        const convertedQuery = query.replace(/\?/g, () => {
            const param = paramsArray[paramIndex - 1];
            convertedParams.push(param);
            return `$${paramIndex++}`;
        });

        return {
            query: convertedQuery,
            params: convertedParams
        };
    }

    /**
     * Convert JSONB fields to strings for consistency
     * PostgreSQL JSONB fields are automatically parsed by pg library,
     * but we convert them to strings to match the expected format
     */
    convertJsonbFields(row) {
        if (!row) return row;

        const jsonbFields = ['segments', 'criteria_scores', 'objections', 'mistakes', 'mood'];
        const converted = { ...row };

        for (const field of jsonbFields) {
            if (converted[field] !== null && converted[field] !== undefined && typeof converted[field] !== 'string') {
                // Convert object/array to JSON string
                try {
                    converted[field] = JSON.stringify(converted[field]);
                } catch (e) {
                    console.warn(`Error converting JSONB field ${field}:`, e);
                }
            }
        }

        return converted;
    }

}

/**
 * Create a database instance
 * @param {string} databaseName - Optional database name (for company-specific databases)
 */
function createDatabaseInstance(databaseName = null) {
    if (databaseName) {
        // Create a separate pool for this specific database
        const config = {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: databaseName, // Use company-specific database
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        };

        const companyPool = new Pool(config);
        return new PostgresDatabase(companyPool);
    } else {
        // Use main database pool
        const pool = getPostgresPool();
        return new PostgresDatabase(pool);
    }
}

/**
 * Create a new PostgreSQL database
 * @param {string} databaseName - Name of the database to create
 */
async function createPostgresDatabase(databaseName) {
    // Connect to default 'postgres' database to create new database
    const adminConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: 'postgres', // Connect to default database
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
    };

    const adminPool = new Pool(adminConfig);
    const client = await adminPool.connect();

    try {
        // Check if database already exists
        const checkResult = await client.query(
            'SELECT 1 FROM pg_database WHERE datname = $1',
            [databaseName]
        );

        if (checkResult.rows.length === 0) {
            // Create the database
            await client.query(`CREATE DATABASE ${databaseName}`);
            console.log(`PostgreSQL database created: ${databaseName}`);
        } else {
            console.log(`PostgreSQL database already exists: ${databaseName}`);
        }
    } finally {
        client.release();
        await adminPool.end();
    }
}

/**
 * Drop a PostgreSQL database
 * @param {string} databaseName - Name of the database to drop
 */
async function dropPostgresDatabase(databaseName) {
    const adminConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: 'postgres',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
    };

    const adminPool = new Pool(adminConfig);
    const client = await adminPool.connect();

    try {
        // Terminate all connections to the database first
        await client.query(`
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = $1
            AND pid <> pg_backend_pid()
        `, [databaseName]);

        // Drop the database
        await client.query(`DROP DATABASE IF EXISTS ${databaseName}`);
        console.log(`PostgreSQL database dropped: ${databaseName}`);
    } finally {
        client.release();
        await adminPool.end();
    }
}

/**
 * Test PostgreSQL connection
 */
async function testConnection() {
    try {
        const pool = getPostgresPool();
        const result = await pool.query('SELECT NOW()');
        console.log('PostgreSQL connection test successful:', result.rows[0]);
        return true;
    } catch (error) {
        console.error('PostgreSQL connection test failed:', error);
        return false;
    }
}

module.exports = {
    initializePostgresPool,
    getPostgresPool,
    createDatabaseInstance,
    createPostgresDatabase,
    dropPostgresDatabase,
    testConnection,
    PostgresDatabase
};

