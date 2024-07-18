// controllers/dispatchController.js
const pool = require('../config/db');

const createDispatch = async (req, res) => {
  const { userId, email } = req.user; // Use the data from the verified token
  const { corporateCode, mrp, skuCode, createdDate } = req.body;

  try {
    const productQuery = `
      SELECT *
      FROM products
      WHERE corporatecode = $1 AND skucode = $2
    `;
    const productResult = await pool.query(productQuery, [corporateCode, skuCode]);

    if (productResult.rows.length === 0) {
      return res.status(400).json({ error: 'Product not found' });
    }

    const dispatchQuery = `
      INSERT INTO dispatches (corporatecode, mrp, skucode, createddate, useremail)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await pool.query(dispatchQuery, [corporateCode, mrp, skuCode, createdDate, email]);

    res.status(201).json({ message: 'Dispatch created successfully' });
  } catch (error) {
    console.error('Error creating dispatch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

  // Function to fetch dispatch data
const getDispatches = async (req, res) => {
    try {
      const dispatchQuery = 'SELECT * FROM dispatches';
      const result = await pool.query(dispatchQuery);
  
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching dispatch data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  
  

// Function to check if product exists in the products table
const checkProductExists = async (corporateCode) => {
  const query = `
    SELECT corporatecode, imgurl
    FROM products
    WHERE corporatecode = $1
  `;
  const result = await pool.query(query, [corporateCode]);
  return result.rows.length > 0;
};

// Function to check if MRP matches the product's MRP
const checkMRPMatch = async (corporateCode, mrp) => {
  const query = `
    SELECT *
    FROM products
    WHERE corporatecode = $1 AND mrp = $2
  `;
  const result = await pool.query(query, [corporateCode, mrp]);
  return result.rows.length > 0;
};
// Function to verify SKU code along with corporate code
const verifySKUCode = async (req, res) => {
    const { corporateCode, skuCode } = req.params;
  
    try {
      // Check if SKU code matches the product's SKU code based on corporate code
      const skuCodeExists = await checkSKUCodeMatchByCorporate(corporateCode, skuCode);
      
      if (skuCodeExists) {
        const product = await getProductBySKUCode(corporateCode, skuCode);
        res.status(200).json(product);
      } else {
        res.status(404).json({ error: 'SKU code does not exist for the given corporate code' });
      }
    } catch (error) {
      console.error('Error verifying SKU code:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  
  // Function to check if SKU code matches the product's SKU code based on corporate code
  const checkSKUCodeMatchByCorporate = async (corporateCode, skuCode) => {
    const query = `
      SELECT id
      FROM products
      WHERE corporatecode = $1 AND skucode = $2
    `;
    const result = await pool.query(query, [corporateCode, skuCode]);
    return result.rows.length > 0;
  };
  
  // Function to retrieve product details by SKU code and corporate code
  const getProductBySKUCode = async (corporateCode, skuCode) => {
    const query = `
      SELECT *
      FROM products
      WHERE corporatecode = $1 AND skucode = $2
    `;
    const result = await pool.query(query, [corporateCode, skuCode]);
    return result.rows[0]; // Assuming there's only one product per corporate code and SKU code combination
  };


// Function to retrieve product details by SKU code
const getSKUInfo = async (req, res) => {
    const { skuCode } = req.params;
  
    try {
      const query = `
        SELECT *
        FROM products
        WHERE skucode = $1
      `;
      const result = await pool.query(query, [skuCode]);
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'SKU code not found' });
      }
  
      const product = result.rows[0];
      res.status(200).json(product);
    } catch (error) {
      console.error('Error retrieving SKU info:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

// Export all functions
module.exports = {
  createDispatch,
  checkProductExists,
  checkMRPMatch,
  verifySKUCode,
  checkSKUCodeMatchByCorporate,
  getProductBySKUCode,
  getSKUInfo,
  getDispatches
};
