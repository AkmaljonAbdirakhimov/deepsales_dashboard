const { createDatabaseInstance, createPostgresDatabase, dropPostgresDatabase } = require('./postgresDatabase');
const { createCompanySchema } = require('./migrations/createCompanySchema');

const companyDbCache = {};
const COMPANY_DB_PREFIX = 'deepsales_analysis_';

/**
 * Get the actual database name for PostgreSQL (with prefix)
 * @param {string} databaseName - Base database name from companies table
 * @returns {string} Actual database name to use
 */
function getActualDatabaseName(databaseName) {
    // For PostgreSQL, add prefix
    return databaseName.startsWith(COMPANY_DB_PREFIX)
        ? databaseName
        : `${COMPANY_DB_PREFIX}${databaseName}`;
}

/**
 * Create a new company database for a company
 * @param {string} databaseName - Name of the database
 * @param {number} companyId - Company ID (optional, for logging)
 * @returns {Promise<Object>} Database instance
 */
async function createCompanyDatabase(databaseName, companyId = null) {
    // Create a new PostgreSQL database for this company
    const actualDbName = getActualDatabaseName(databaseName);
    try {
        // Create the PostgreSQL database with prefix
        await createPostgresDatabase(actualDbName);

        // Create schema in the new database
        await createCompanySchema(actualDbName);

        // Create database instance connected to this specific database
        const db = createDatabaseInstance(actualDbName);

        // Seed initial data
        await seedCompanyData(db);

        console.log(`Company database created (PostgreSQL): ${actualDbName}${companyId ? ` (company_id: ${companyId})` : ''}`);
        return db;
    } catch (error) {
        console.error(`Error creating PostgreSQL database ${actualDbName}:`, error);
        throw error;
    }
}

/**
 * Seed initial data for company database
 */
async function seedCompanyData(db) {
    try {
        // Check if Sales category already exists
        const existingCategory = await db.get(
            'SELECT id FROM conversation_categories WHERE name = ?',
            'Sotuv'
        );

        if (!existingCategory) {
            // Create Sales category
            const salesResult = await db.run(
                'INSERT INTO conversation_categories (name) VALUES (?)',
                'Sotuv'
            );
            const salesCategoryId = salesResult.lastID;

            // Create Sales criteria
            const salesCriteria = [
                {
                    name: 'Salomlashish va suhbatni boshlash',
                    description: `Qoidalar:
- Salomlashish bilan boshlashi kerak
- Mijozdan hol-ahvol so'rash
- Mijozning ismini so'rab, ismi bilan murojaat qilish
- O'zini tanishtirish va kompaniya nomini aytish
- Gaplashish uchun qulay vaqt ekanligini so'rash`
                },
                {
                    name: 'Ehtiyojni aniqlash — SPIN texnikasi',
                    description: `S (Situation): Mijozning hozirgi holatini bilishga qaratilgan savollar.
P (Problem): Mijozning haqiqiy muammosini aniqlovchi savollar.
I (Implication): Muammo hal qilinmasa oqibatlari qanday bo'lishi haqida savollar.
N (Need-Payoff): Mahsulot yechim bo'lishi va mijozga qanday foyda berishini aniqlovchi savollar.

Asosiy qoida: Mijoz suhbat davomida "Ha, bunaqa yechim bo'lsa foydalangan bo'lardim" deb javob berishi kerak.`
                },
                {
                    name: 'Mahsulotni tushuntirish',
                    description: `3.1. Mahsulotni ifoda etish:
- Mahsulotni mijozning og'riqlariga bog'lash
- Faqat kerakli jihatlarini aytish
- Kuchli tomonlarni aniq ko'rsatish

3.2. Mahsulot qanday ishlashini tushuntirish:
- Bosqichma-bosqich, sodda, tushunarli tushuntirish

3.3. Manfaatlarni mustahkamlash:
- SPIN bosqichidagi og'riqni qayta eslatish
- Mahsulot yechimini muammo bilan bog'lash`
                },
                {
                    name: 'Keyingi qadamni osonlashtirish',
                    description: `Qoidalar:
- Keyingi qadamni ochiq, aniq taklif qiladi
- "Olasizmi yo'qmi?" degan savollarga yo'l qo'ymaydi
- Faqat "Ha" deb javob beriladigan savollar beradi

Misol uchun:
- "Qachon to'lovni amalga oshirasiz?"
- "Qaysi usulda to'laysiz?"
- "Qaysi filialga kelasiz?"`
                },
                {
                    name: 'E\'tirozlar bilan ishlash',
                    description: `Qoidalar:
- E'tirozga darhol javob bermaydi
- Avval barcha e'tirozlarni yig'adi
- Eng asosiy e'tirozni aniqlaydi
- Faqat asosiy e'tirozga yechim beradi
- Bahslashmaydi, himoyalanmaydi`
                }
            ];

            for (const criterion of salesCriteria) {
                await db.run(
                    'INSERT INTO conversation_criteria (category_id, name, description) VALUES (?, ?, ?)',
                    salesCategoryId,
                    criterion.name,
                    criterion.description
                );
            }
        }
    } catch (error) {
        console.log('Company seed data note:', error.message);
    }
}

/**
 * Get company database instance (with caching)
 * @param {string} databaseName - Name of the database
 * @returns {Promise<Object>} Database instance
 */
async function getCompanyDatabase(databaseName) {
    if (!databaseName) {
        throw new Error('Database name is required');
    }

    // For PostgreSQL, use prefixed database name
    const actualDbName = getActualDatabaseName(databaseName);

    // Check cache first (using base name as key)
    if (companyDbCache[databaseName]) {
        return companyDbCache[databaseName];
    }

    // Check if database exists by trying to connect
    try {
        const db = createDatabaseInstance(actualDbName);
        // Test connection
        await db.get('SELECT 1');

        // Cache the database connection (using base name as key)
        companyDbCache[databaseName] = db;
        return db;
    } catch (error) {
        throw new Error(`Company database not found: ${actualDbName}. Error: ${error.message}`);
    }
}

/**
 * Delete company database
 * @param {string} databaseName - Name of the database to delete
 */
async function deleteCompanyDatabase(databaseName) {
    // For PostgreSQL, use prefixed database name
    const actualDbName = getActualDatabaseName(databaseName);

    // Remove from cache first
    if (companyDbCache[databaseName]) {
        // Close all connections in the pool
        const pool = companyDbCache[databaseName].getPool ? companyDbCache[databaseName].getPool() : companyDbCache[databaseName].pool;
        if (pool && pool.end) {
            await pool.end();
        }
        delete companyDbCache[databaseName];
    }

    // Drop the database
    await dropPostgresDatabase(actualDbName);
    console.log(`Company database deleted (PostgreSQL): ${actualDbName}`);
}

module.exports = {
    createCompanyDatabase,
    getCompanyDatabase,
    deleteCompanyDatabase,
    getActualDatabaseName,
    COMPANY_DB_PREFIX
};
