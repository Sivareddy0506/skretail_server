const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json({ limit: '50mb' })); // Using built-in express.json() middleware
app.use(cors());

// Import routes
const authRoutes = require('../routes/authRoutes');
const productRoutes = require('../routes/productRoutes');
const dispatchRoutes = require('../routes/dispatchRoutes');
const dashboardRoutes = require('../routes/dashboardRoutes');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api', dashboardRoutes); // Example: '/api/dashboard'


app.get('/', (req, res) => {
  res.send('API is working');
});

module.exports = app;
