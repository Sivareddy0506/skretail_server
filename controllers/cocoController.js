const pool = require('../config/db');
const format = require('pg-format'); // Import pg-format
const bwipjs = require('bwip-js');

// Function to generate barcode
const generateBarcode = async (code) => {
  try {
    const png = await bwipjs.toBuffer({
      bcid: 'code128',          // Barcode type
      text: code,               // Text to encode
      scale: 3,                 // 3x scaling factor
      height: 10,               // Bar height, in millimeters
      includetext: false,       // Do not include text
      textxalign: 'center',     // Center-align the text
      textyoffset: -10,         // Offset the text to move it out of the barcode
    });

    return png.toString('base64');
  } catch (err) {
    console.error('Error generating barcode:', err);
    return null;
  }
};


// Function to find duplicate ASINs in the chunk
const findDuplicateInChunk = (chunk) => {
  const seen = new Set();
  const duplicates = new Set();
  chunk.forEach(row => {
    console.log('Checking ASIN:', row.ASIN); 
    const code = row.ASIN;
    if (code && seen.has(code)) {
      duplicates.add(code);
    } else if (code) {
      seen.add(code);
    }
  });
  return Array.from(duplicates);
};

// Function to check for duplicate ASINs in the database
const checkDuplicates = async (asins) => {
  const query = `
    SELECT asin 
    FROM cocoblu 
    WHERE asin = ANY($1::varchar[])
  `;
  const result = await pool.query(query, [asins]);
  return result.rows.map(row => row.asin);
};

// Function to handle escaping single quotes
const escapeSingleQuotes = (value) => {
  const strValue = value ? String(value) : '';
  return strValue.replace(/'/g, "''");
};

// Function to handle chunk upload
exports.uploadChunk = async (req, res) => {
  const { data: chunk } = req.body; // Extract chunk data from the request body
  const errors = [];
  const validData = [];
  const currentDate = new Date().toISOString(); // Current timestamp

  if (!chunk || chunk.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }

  console.log('Received chunk:', chunk);

  // Step 1: Check for duplicates within the chunk
  const uniqueASINs = new Set();
  chunk.forEach(item => {
    if (item.ASIN && item.ASIN.trim() !== '') {
      if (uniqueASINs.has(item.ASIN)) {
        errors.push({ ...item, error: 'Duplicate in chunk' });
      } else {
        uniqueASINs.add(item.ASIN);
        validData.push(item);
      }
    }
  });

  if (errors.length > 0) {
    return res.status(400).json({ errors, validData });
  }

  try {
    // Step 2: Check for duplicates in the database
    const asins = validData.map(item => item.ASIN);
    const result = await pool.query(
      'SELECT asin FROM cocoblu WHERE asin = ANY($1::text[])',
      [asins]
    );

    // Create errors based on database results
    const databaseErrors = validData.filter(item =>
      result.rows.some(row => row.asin === item.ASIN)
    ).map(item => ({ ...item, error: 'Duplicate in database' }));

    if (databaseErrors.length > 0) {
      const filteredValidData = validData.filter(item =>
        !databaseErrors.some(error => error.ASIN === item.ASIN)
      );

      return res.status(400).json({ errors: [...databaseErrors, ...errors], validData: filteredValidData });
    }

    // Step 3: Generate barcodes for each ASIN if not provided
    const chunkWithBarcodes = await Promise.all(validData.map(async (item) => {
      if (!item.ASIN || item.ASIN.trim() === '') {
        return null; // Skip rows with empty ASIN
      }

      try {
        // Generate barcode if not provided
        const barcode = item.BARCODE || await generateBarcode(item.ASIN);
        if (!barcode) {
          throw new Error(`Failed to generate barcode for ASIN: ${item.ASIN}`);
        }

        return {
          ...item,
          barcode
        };
      } catch (error) {
        console.error(`Error generating barcode for ASIN ${item.ASIN}:`, error);
        return null;
      }
    }));

    // Filter out null rows
    const filteredRows = chunkWithBarcodes.filter(item => item !== null);

    console.log('Chunk with barcodes:', filteredRows);

    // Step 4: Check if filteredRows is empty
    if (filteredRows.length === 0) {
      return res.status(400).json({ error: 'No valid data to insert' });
    }

    // Step 5: Insert data into the database
    const insertQuery = `
      INSERT INTO cocoblu 
      (asin, name_of_the_commodity, net_quantity, MRP, manufactured_and_packed_by, marketed_by, contact_customer_care_executive_at, unit_sale_price, made_in_india, barcode, created_at, updated_at)
      VALUES %L
    `;

    const values = filteredRows.map(item => [
      item.ASIN,
      item['NAME OF THE COMMODITY'],
      item['NET QUANTITY'],
      item.MRP,
      item['MANUFACTURED, PACKED AND MARKETED BY'],
      item['MARKETED BY'],
      item['CONTACT CUSTOMER CARE EXECUTIVE AT'],
      item['UNIT SALE PRICE'],
      item['MADE IN INDIA'],
      item.barcode,
      currentDate,
      currentDate
    ]);

    const formattedQuery = format(insertQuery, values);
    console.log('Formatted query:', formattedQuery);

    await pool.query(formattedQuery);

    res.status(200).json({ message: 'File uploaded successfully' });
  } catch (error) {
    console.error('Error inserting data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};




// Function to retrieve all products
exports.getData = async (req, res) => {
  const query = `
    SELECT * FROM cocoblu
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

// Function to update a product
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
