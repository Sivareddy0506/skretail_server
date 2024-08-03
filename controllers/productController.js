const pool = require('../config/db');


exports.uploadChunk = async (req, res) => {
  const { data } = req.body;
  const errors = [];
  const validData = [];

  try {
    const client = await pool.connect();

    // Check for duplicates in the chunk
    const uniqueCorporateCodes = new Set();
    data.forEach(item => {
      if (uniqueCorporateCodes.has(item.corporatecode)) {
        // Include all fields of the item in the errors
        errors.push({ ...item, error: 'Duplicate in chunk' });
      } else {
        uniqueCorporateCodes.add(item.corporatecode);
        validData.push(item);
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({ errors, validData });
    }

    // Check for duplicates in the database
    const corporateCodes = validData.map(item => item.corporatecode);
    const result = await client.query(
      'SELECT corporatecode FROM products WHERE corporatecode = ANY($1::text[])',
      [corporateCodes]
    );

    // Create errors based on database results
    const databaseErrors = validData.filter(item =>
      result.rows.some(row => row.corporatecode === item.corporatecode)
    ).map(item => ({ ...item, error: 'Duplicate in database' }));

    if (databaseErrors.length > 0) {
      // Exclude errors from validData
      const filteredValidData = validData.filter(item =>
        !databaseErrors.some(error => error.corporatecode === item.corporatecode)
      );

      return res.status(400).json({ errors: [...databaseErrors, ...errors], validData: filteredValidData });
    }

    // Insert data into the database
    const insertQuery = 'INSERT INTO products (skucode, corporatecode, imageurl) VALUES ($1, $2, $3)';
    const insertPromises = validData.map(item =>
      client.query(insertQuery, [item.skucode, item.corporatecode, item.imageurl])
    );

    await Promise.all(insertPromises);
    client.release();

    return res.status(200).json({ message: 'Data uploaded successfully' });
  } catch (error) {
    console.error('Error uploading data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};



// Function to retrieve all products
exports.getData = async (req, res) => {
  const query = `
    SELECT * FROM products
  `;

  try {
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error retrieving data:', error);
    res.status(500).send('Error retrieving data');
  }
};

// Function to retrieve a product by corporate code
exports.getProductByCorporateCode = async (req, res) => {
  const { corporateCode } = req.params;
  const query = `
    SELECT * FROM products WHERE corporatecode = $1
  `;

  try {
    const result = await pool.query(query, [corporateCode]);
    if (result.rows.length === 0) {
      return res.status(404).send('Product not found');
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error retrieving product:', error);
    res.status(500).send('Error retrieving product');
  }
};


exports.updateProduct = async (req, res) => {
  const { corporateCode } = req.params;
  const { skucode, imageurl } = req.body;
  
  const query = `
    UPDATE products 
    SET skucode = $1, imageurl = $2, updated_at = NOW() 
    WHERE corporatecode = $3
  `;

  try {
    const result = await pool.query(query, [skucode, imageurl, corporateCode]);

    if (result.rowCount === 0) {
      return res.status(404).send('Product not found'); // Return 404 if no rows were updated
    }

    res.status(200).send('Product updated successfully');
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).send('Error updating product');
  }
};


// Function to delete a product
exports.deleteProduct = async (req, res) => {
  const { corporateCode } = req.params;
  const query = `
    DELETE FROM products WHERE corporatecode = $1
  `;

  try {
    const result = await pool.query(query, [corporateCode]);
    if (result.rowCount === 0) {
      return res.status(404).send('Product not found');
    }
    res.status(200).send('Product deleted successfully');
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).send('Error deleting product');
  }
};
