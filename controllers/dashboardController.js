// dashboardController.js

// Import necessary functions from dashboardModel
const { getProductCount, getDispatchCount, getProductCountByDate, getDispatchCountByDate } = require('../models/dashboardModel');

// Function to fetch dashboard data
const getDashboardData = async (req, res) => {
  try {
    // Logic to fetch dashboard data
    const productCount = await getProductCount();
    const dispatchCount = await getDispatchCount();
    const productCountByDate = await getProductCountByDate();
    const dispatchCountByDate = await getDispatchCountByDate();

    // Construct response object
    const dashboardData = {
      productCount,
      dispatchCount,
      productCountByDate,
      dispatchCountByDate,
    };

    // Send JSON response
    res.json(dashboardData);
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getDashboardData,
};
