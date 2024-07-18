const pool = require('../config/db');

// Function to check for duplicate corporate codes in the database
const checkDuplicates = async (corporateCodes) => {
  const query = `
    SELECT corporatecode 
    FROM products 
    WHERE corporatecode = ANY($1::varchar[])
  `;
  const result = await pool.query(query, [corporateCodes]);
  return result.rows.map(row => row.corporatecode);
};

// Function to find duplicate corporate codes in a chunk of data
const findDuplicateInChunk = (chunk) => {
  const seen = new Set();
  const duplicates = new Set();
  chunk.forEach(row => {
    if (seen.has(row.corporatecode)) {
      duplicates.add(row.corporatecode);
    } else {
      seen.add(row.corporatecode);
    }
  });
  return Array.from(duplicates);
};

// Function to handle uploading a chunk of data
exports.uploadChunk = async (req, res) => {
  const chunk = req.body.data;
  const corporateCodes = chunk.map(row => row.corporatecode);

  const duplicateInChunk = findDuplicateInChunk(chunk);
  if (duplicateInChunk.length > 0) {
    return res.status(400).json({ error: `Duplicate corporate codes in the chunk: ${duplicateInChunk.join(', ')}` });
  }

  try {
    const duplicatesInDB = await checkDuplicates(corporateCodes);

    if (duplicatesInDB.length > 0) {
      return res.status(400).json({ error: `Duplicate corporate codes in the database: ${duplicatesInDB.join(', ')}` });
    }

    const currentDate = new Date().toISOString(); // Current timestamp

    const values = chunk.map(row => `('${row.corporatecode}', '${row.skucode}', '${row.imageurl}', '${currentDate}', '${currentDate}')`).join(',');

    const query = `
      INSERT INTO products (corporatecode, skucode, imageurl, created_at, updated_at)
      VALUES ${values}
    `;

    await pool.query(query);
    res.status(200).send('Chunk uploaded successfully');
  } catch (error) {
    console.error('Error inserting chunk:', error);
    res.status(500).send('Error inserting chunk');
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
