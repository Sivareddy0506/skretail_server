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
const mrpRoutes = require('../routes/mrpRoutes');
const gnRoutes = require('../routes/gnRoutes');
const apparioRoutes = require('../routes/apparioRoutes');
const cocoRoutes = require('../routes/cocoRoutes');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/mrp', mrpRoutes);
app.use('/api/gn', gnRoutes);
app.use('/api/appario', apparioRoutes);
app.use('/api/coco', cocoRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api', dashboardRoutes); // Example: '/api/dashboard'


app.get('/', (req, res) => {
  res.send('API is working');
});

module.exports = app;