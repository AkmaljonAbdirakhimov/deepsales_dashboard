// GET /api/categories - Get all categories with their criteria
async function getCategories(req, res) {
    try {
        const db = req.companyDb;
        const categories = await db.all('SELECT * FROM conversation_categories ORDER BY created_at DESC');

        // Get criteria for each category
        for (const category of categories) {
            const criteria = await db.all(
                'SELECT * FROM conversation_criteria WHERE category_id = ? ORDER BY created_at ASC',
                category.id
            );
            category.criteria = criteria;
        }

        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: error.message });
    }
}

// POST /api/categories - Create a new category
async function createCategory(req, res) {
    try {
        const { name } = req.body;
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Category name is required' });
        }

        const db = req.companyDb;
        const result = await db.run(
            'INSERT INTO conversation_categories (name) VALUES (?)',
            name.trim()
        );

        const category = await db.get('SELECT * FROM conversation_categories WHERE id = ?', result.lastID);
        category.criteria = [];

        res.status(201).json(category);
    } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'Category with this name already exists' });
        }
        console.error('Error creating category:', error);
        res.status(500).json({ error: error.message });
    }
}

// PUT /api/categories/:id - Update a category
async function updateCategory(req, res) {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Category name is required' });
        }

        const db = req.companyDb;
        await db.run('UPDATE conversation_categories SET name = ? WHERE id = ?', name.trim(), id);

        const category = await db.get('SELECT * FROM conversation_categories WHERE id = ?', id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const criteria = await db.all(
            'SELECT * FROM conversation_criteria WHERE category_id = ? ORDER BY created_at ASC',
            id
        );
        category.criteria = criteria;

        res.json(category);
    } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'Category with this name already exists' });
        }
        console.error('Error updating category:', error);
        res.status(500).json({ error: error.message });
    }
}

// DELETE /api/categories/:id - Delete a category (cascades to criteria)
async function deleteCategory(req, res) {
    try {
        const { id } = req.params;
        const db = req.companyDb;

        // Check if category exists
        const category = await db.get('SELECT * FROM conversation_categories WHERE id = ?', id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Delete category (criteria will be deleted automatically due to CASCADE)
        await db.run('DELETE FROM conversation_categories WHERE id = ?', id);

        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: error.message });
    }
}

// POST /api/criteria - Create a new criterion
async function createCriterion(req, res) {
    try {
        const { category_id, name, description } = req.body;

        if (!category_id || !name || name.trim() === '') {
            return res.status(400).json({ error: 'Category ID and criterion name are required' });
        }

        const db = req.companyDb;

        // Verify category exists
        const category = await db.get('SELECT * FROM conversation_categories WHERE id = ?', category_id);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const result = await db.run(
            'INSERT INTO conversation_criteria (category_id, name, description) VALUES (?, ?, ?)',
            category_id,
            name.trim(),
            description ? description.trim() : null
        );

        const criterion = await db.get('SELECT * FROM conversation_criteria WHERE id = ?', result.lastID);
        res.status(201).json(criterion);
    } catch (error) {
        console.error('Error creating criterion:', error);
        res.status(500).json({ error: error.message });
    }
}

// PUT /api/criteria/:id - Update a criterion
async function updateCriterion(req, res) {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Criterion name is required' });
        }

        const db = req.companyDb;
        await db.run(
            'UPDATE conversation_criteria SET name = ?, description = ? WHERE id = ?',
            name.trim(),
            description ? description.trim() : null,
            id
        );

        const criterion = await db.get('SELECT * FROM conversation_criteria WHERE id = ?', id);
        if (!criterion) {
            return res.status(404).json({ error: 'Criterion not found' });
        }

        res.json(criterion);
    } catch (error) {
        console.error('Error updating criterion:', error);
        res.status(500).json({ error: error.message });
    }
}

// DELETE /api/criteria/:id - Delete a criterion
async function deleteCriterion(req, res) {
    try {
        const { id } = req.params;
        const db = req.companyDb;

        // Check if criterion exists
        const criterion = await db.get('SELECT * FROM conversation_criteria WHERE id = ?', id);
        if (!criterion) {
            return res.status(404).json({ error: 'Criterion not found' });
        }

        await db.run('DELETE FROM conversation_criteria WHERE id = ?', id);
        res.json({ message: 'Criterion deleted successfully' });
    } catch (error) {
        console.error('Error deleting criterion:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    createCriterion,
    updateCriterion,
    deleteCriterion
};
