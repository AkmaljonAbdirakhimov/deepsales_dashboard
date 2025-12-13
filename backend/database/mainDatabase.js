const { createDatabaseInstance, initializePostgresPool, testConnection } = require('./postgresDatabase');
const { createMainSchema } = require('./migrations/createMainSchema');

let mainDb;

/**
 * Initialize main database (for users and companies)
 * Uses PostgreSQL
 */
async function initializeMainDatabase() {
    // Initialize PostgreSQL
    initializePostgresPool();

    // Test connection
    const connected = await testConnection();
    if (!connected) {
        throw new Error('Failed to connect to PostgreSQL database');
    }

    // Create schema if it doesn't exist
    await createMainSchema();

    // Create database instance
    mainDb = createDatabaseInstance();

    console.log('Main database initialized (PostgreSQL)');

    // Create default super admin if not exists
    await seedSuperAdmin();

    // Seed default pricing plans if not exists
    await seedPricingPlans();

    return mainDb;
}

/**
 * Seed default super admin user
 */
async function seedSuperAdmin() {
    try {
        const { hashPassword } = require('../utils/password');

        const existingAdmin = await mainDb.get(
            'SELECT id FROM users WHERE role = ?',
            'super_admin'
        );

        if (!existingAdmin) {
            const defaultUsername = process.env.SUPER_ADMIN_USERNAME;
            const defaultPassword = process.env.SUPER_ADMIN_PASSWORD;
            const passwordHash = await hashPassword(defaultPassword);

            await mainDb.run(
                'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
                defaultUsername,
                passwordHash,
                'super_admin'
            );

            console.log('Default super admin created: username=' + defaultUsername + ', password=' + defaultPassword);
        }
    } catch (error) {
        console.error('Error seeding super admin:', error.message);
    }
}

/**
 * Seed default pricing plans
 */
async function seedPricingPlans() {
    try {
        const defaultPlans = [
            {
                name: 'Start',
                description: 'Good',
                price: 49.0,
                max_managers: 5,
                hours_per_manager: 24.0,
                price_per_manager: 20.0,
                price_per_hour: 1.75
            },
            {
                name: 'Pro',
                description: 'Great',
                price: 499.0,
                max_managers: 15,
                hours_per_manager: 50.0,
                price_per_manager: 15.0,
                price_per_hour: 1.75
            },
            {
                name: 'Enterprise',
                description: 'Awesome',
                price: 1999.0,
                max_managers: 1000,
                hours_per_manager: 70.0,
                price_per_manager: 10.0,
                price_per_hour: 1.5
            }
        ];

        for (const plan of defaultPlans) {
            const existingPlan = await mainDb.get(
                'SELECT id FROM pricing_plans WHERE name = ?',
                plan.name
            );

            if (!existingPlan) {
                await mainDb.run(
                    `INSERT INTO pricing_plans (name, description, price, max_managers, hours_per_manager, price_per_manager, price_per_hour)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    plan.name,
                    plan.description,
                    plan.price,
                    plan.max_managers,
                    plan.hours_per_manager,
                    plan.price_per_manager,
                    plan.price_per_hour
                );

                console.log(`Default pricing plan created: ${plan.name}`);
            }
        }
    } catch (error) {
        console.error('Error seeding pricing plans:', error.message);
    }
}

/**
 * Get main database instance
 */
function getMainDb() {
    if (!mainDb) {
        throw new Error('Main database not initialized');
    }
    return mainDb;
}

module.exports = {
    initializeMainDatabase,
    getMainDb
};
