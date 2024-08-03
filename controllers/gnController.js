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


const findDuplicateInChunk = (chunk) => {
  const seen = new Set();
  const duplicates = new Set();
  chunk.forEach(row => {
    const code = row.FSN;
    if (code && seen.has(code)) {
      duplicates.add(code);
    } else if (code) {
      seen.add(code);
    }
  });
  return Array.from(duplicates);
};

const checkDuplicates = async (fsns) => {
  const query = `
    SELECT fsn 
    FROM mrpflipkartgn 
    WHERE fsn = ANY($1::varchar[])
  `;
  const result = await pool.query(query, [fsns]);
  return result.rows.map(row => row.fsn);
};

const escapeSingleQuotes = (value) => {
  const strValue = value ? String(value) : '';
  return strValue.replace(/'/g, "''");
};


exports.uploadChunk = async (req, res) => {
  const { data } = req.body;
  const errors = [];
  const validData = [];
  const currentDate = new Date().toISOString(); // Current timestamp

  if (!data || data.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }

  try {
    const client = await pool.connect();

    // Step 1: Check for duplicates within the chunk
    const uniqueFSNs = new Set();
    data.forEach(item => {
      if (item.FSN && item.FSN.trim() !== '') {
        if (uniqueFSNs.has(item.FSN)) {
          errors.push({ ...item, error: 'Duplicate in chunk' });
        } else {
          uniqueFSNs.add(item.FSN);
          validData.push(item);
        }
      }
    });

    if (errors.length > 0) {
      client.release();
      return res.status(400).json({ errors, validData });
    }

    // Step 2: Check for duplicates in the database
    const fsns = validData.map(item => item.FSN);
    const result = await client.query(
      'SELECT fsn FROM mrpflipkartgn WHERE fsn = ANY($1::text[])',
      [fsns]
    );

    // Step 3: Create errors based on database results
    const databaseErrors = validData.filter(item =>
      result.rows.some(row => row.fsn === item.FSN)
    ).map(item => ({ ...item, error: 'Duplicate in database' }));

    if (databaseErrors.length > 0) {
      const filteredValidData = validData.filter(item =>
        !databaseErrors.some(error => error.FSN === item.FSN)
      );

      client.release();
      return res.status(400).json({ errors: [...databaseErrors, ...errors], validData: filteredValidData });
    }

    // Step 4: Generate barcodes for each FSN if not provided
    const chunkWithBarcodes = await Promise.all(validData.map(async (item) => {
      if (!item.FSN || item.FSN.trim() === '') {
        return null; // Skip rows with empty FSN
      }

      try {
        // Generate barcode if not provided
        const barcode = item.BARCODE || await generateBarcode(item.FSN);
        if (!barcode) {
          throw new Error(`Failed to generate barcode for FSN: ${item.FSN}`);
        }

        return {
          ...item,
          barcode,
          consumer_complaints_contact: item['For Consumer Complaints'] || ''
        };
      } catch (error) {
        console.error(`Error generating barcode for FSN ${item.FSN}:`, error);
        return null;
      }
    }));

    // Filter out null rows
    const filteredRows = chunkWithBarcodes.filter(item => item !== null);

    if (filteredRows.length === 0) {
      client.release();
      return res.status(400).json({ error: 'No valid data to insert' });
    }

    // Step 5: Insert data into the database
    const insertQuery = `
      INSERT INTO mrpflipkartgn 
      (SKU, marketed_by, manufactured_by, date_of_manufacture, brand, net_quantity, country_of_origin, MRP, consumer_complaints_contact, review, FSN, barcode, created_at, updated_at)
      VALUES %L
    `;

    const values = filteredRows.map(item => [
      item.SKU,
      item['Marketed By'],
      item['Manufactured By'],
      item['Date of Manufacture'],
      item.Brand,
      item['Net Quantity'],
      item['Country of Origin'],
      item.MRP,
      item.consumer_complaints_contact,
      item.Review,
      item.FSN,
      item.barcode,
      currentDate,
      currentDate
    ]);

    const formattedQuery = format(insertQuery, values);
    console.log('Executing query:', formattedQuery);

    await client.query(formattedQuery);

    client.release();
    res.status(200).json({ message: 'Data uploaded successfully' });
  } catch (error) {
    console.error('Error uploading data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};




// Function to retrieve all products
exports.getData = async (req, res) => {
  const query = `
    SELECT * FROM mrpflipkartgn
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
