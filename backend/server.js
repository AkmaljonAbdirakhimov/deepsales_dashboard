require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeMainDatabase } = require('./database/mainDatabase');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/companies');
const pricingPlanRoutes = require('./routes/pricingPlans');

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced CORS configuration
const allowedOrigins = [
    'https://dashboard.deepsales.uz'
];
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Serve uploads (audio files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/pricing-plans', pricingPlanRoutes);
app.use('/api', apiRoutes);

async function startServer() {
    try {
        await initializeMainDatabase();
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
    }
}

startServer();

