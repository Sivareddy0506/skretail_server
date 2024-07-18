// dashboardModel.js

const pool = require('../config/db'); // Import your database connection pool or client


// Function to get total count of records from a table
const getTotalCount = async (tableName) => {
    try {
      const query = `SELECT COUNT(*) AS total_count FROM ${tableName}`;
      const result = await pool.query(query);
      return result.rows[0].total_count;
    } catch (err) {
      console.error(`Error fetching total count from ${tableName}:`, err);
      throw err;
    }
  };

// Function to get total count of records updated datewise
const getCountByDate = async (tableName) => {
    try {
      let dateColumn = tableName === 'products' ? 'updated_at' : 'createddate';
      const query = `
        SELECT COUNT(*) AS count, DATE(${dateColumn}) AS date
        FROM ${tableName}
        GROUP BY DATE(${dateColumn})
        ORDER BY DATE(${dateColumn}) DESC
      `;
      const result = await pool.query(query);
      return result.rows;
    } catch (err) {
      console.error(`Error fetching count by date from ${tableName}:`, err);
      throw err;
    }
  };
  


// Function to get product count from database
const getProductCount = async () => {
  return getTotalCount('products');
};

// Function to get dispatch count from database
const getDispatchCount = async () => {
  return getTotalCount('dispatches');
};

// Function to get product count updated datewise
const getProductCountByDate = async () => {
  return getCountByDate('products');
};

// Function to get dispatch count updated datewise
const getDispatchCountByDate = async () => {
  return getCountByDate('dispatches');
};

module.exports = {
  getProductCount,
  getDispatchCount,
  getProductCountByDate,
  getDispatchCountByDate,
};
