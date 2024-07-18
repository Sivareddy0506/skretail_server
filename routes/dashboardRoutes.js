// dashboardRoute.js

const express = require('express');
const router = express.Router();
const { getDashboardData } = require('../controllers/dashboardController');

// Define routes
router.get('/dashboard', getDashboardData);

module.exports = router;
