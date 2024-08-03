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


// Function to find duplicate FSNs in the chunk
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

// Function to check for duplicate FSNs in the database
const checkDuplicates = async (fsns) => {
  const query = `
    SELECT fsn 
    FROM mrpflipkartzap 
    WHERE fsn = ANY($1::varchar[])
  `;
  const result = await pool.query(query, [fsns]);
  return result.rows.map(row => row.fsn);
};

// Function to handle escaping single quotes
const escapeSingleQuotes = (value) => {
  const strValue = value ? String(value) : '';
  return strValue.replace(/'/g, "''");
};

exports.uploadChunk = async (req, res) => {
  const { data } = req.body;
  const errors = [];
  const validData = [];
  const currentDate = new Date().toISOString(); // Current timestamp

  try {
    const client = await pool.connect();

    // Step 1: Check for duplicates within the chunk
    const uniqueFSNs = new Set();
    data.forEach(item => {
      if (uniqueFSNs.has(item.FSN)) {
        errors.push({ ...item, error: 'Duplicate in chunk' });
      } else {
        uniqueFSNs.add(item.FSN);
        validData.push(item);
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({ errors, validData });
    }

    // Step 2: Check for duplicates in the database
    const fsns = validData.map(item => item.FSN);
    const result = await client.query(
      'SELECT fsn FROM mrpflipkartzap WHERE fsn = ANY($1::text[])',
      [fsns]
    );

    // Step 3: Create errors based on database results
    const databaseErrors = validData.filter(item =>
      result.rows.some(row => row.fsn === item.FSN)
    ).map(item => ({ ...item, error: 'Duplicate in database' }));

    if (databaseErrors.length > 0) {
      // Exclude database errors from validData
      const filteredValidData = validData.filter(item =>
        !databaseErrors.some(error => error.FSN === item.FSN)
      );

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
          barcode
        };
      } catch (error) {
        console.error(`Error generating barcode for FSN ${item.FSN}:`, error);
        return null;
      }
    }));

    // Filter out null rows
    const filteredRows = chunkWithBarcodes.filter(item => item !== null);

    // Step 5: Insert data into the database
    if (filteredRows.length > 0) {
      const insertQuery = `
        INSERT INTO mrpflipkartzap 
        (SKU, name_of_the_commodity, MRP, net_quantity, month_and_year_of_manufacture, manufactured_packed_and_marketed_by, product_dimensions, contact_customer_care_executive_at, country_of_origin, brand, barcode, fsn, created_at, updated_at)
        VALUES %L
      `;

      const values = filteredRows.map(item => [
        item.SKU,
        item['NAME OF THE COMMODITY'],
        item.MRP,
        item['NET QUANTITY'],
        item['MONTH AND YEAR OF MANUFACTURE'],
        item['MANUFACTURED, PACKED AND MARKETED BY'],
        item['PRODUCT DIMENSIONS'],
        item['CONTACT CUSTOMER CARE EXECUTIVE AT'],
        item['COUNTRY OF ORIGIN'],
        item.BRAND,
        item.barcode,
        item.FSN,
        currentDate,
        currentDate
      ]);

      const formattedQuery = format(insertQuery, values);
      console.log('Executing query:', formattedQuery);

      await client.query(formattedQuery);
    }

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
    SELECT * FROM mrpflipkartzap
  `;

  try {
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error retrieving data:', error);
    res.status(500).send('Error retrieving data');
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
// Function to delete a product
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'ID parameter is required' });
  }

  const tables = {
    mrpflipkartzap: 'fsn',
    mrpflipkartgn: 'fsn',
    appario: 'asin',
    cocoblu: 'asin'
  };

  try {
    let totalDeletedRows = 0;

    for (const [table, column] of Object.entries(tables)) {
      const result = await pool.query(`DELETE FROM ${table} WHERE ${column} = $1`, [id]);
      totalDeletedRows += result.rowCount;
    }

    if (totalDeletedRows === 0) {
      return res.status(404).json({ error: 'No data found to delete for the provided ID' });
    }

    res.status(200).json({ message: 'Product deleted successfully', deletedRows: totalDeletedRows });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



// Controller function to get data by id
exports.getDataById = async (req, res) => {
  const { id } = req.query; // `id` can be either `ASIN` or `FSN`

  if (!id) {
    return res.status(400).json({ error: 'ID query parameter is required' });
  }

  try {
    const tables = {
      mrpflipkartzap: 'fsn',
      mrpflipkartgn: 'fsn',
      appario: 'asin',
      cocoblu: 'asin'
    };

    let data = [];

    for (const [table, column] of Object.entries(tables)) {
      const result = await pool.query(`SELECT * FROM ${table} WHERE ${column} = $1`, [id]);
      data = data.concat(result.rows);
    }

    if (data.length === 0) {
      return res.status(404).json({ error: 'No data found for the provided ID' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



exports.createPrintDetails = async (req, res) => {
  // Extract required fields from the request body
  const { corporatecode, brand, manufacturedate, createdDate } = req.body;
  // Extract user email from the token
  const userEmail = req.user?.email;

  // Check if userEmail is available
  if (!userEmail) {
      return res.status(400).json({ error: 'User email not found in token' });
  }

  // SQL query to insert print details with 5 parameters
  const query = `
      INSERT INTO printedmrp (corporatecode, brand, manufacturedate, createdDate, useremail)
      VALUES ($1, $2, $3, $4, $5)
  `;

  // Values to be inserted into the table
  const values = [corporatecode, brand, manufacturedate, createdDate, userEmail];

  // console.log('Executing query:', query);
  // console.log('With parameters:', values);

  try {
      // Execute the query with the provided values
      await pool.query(query, values);
      res.status(201).json({ message: 'Print details saved successfully' });
  } catch (error) {
      console.error('Error saving print data:', error);
      res.status(500).json({ error: 'Error saving print data' });
  }
};


exports.getPrintedMrp = async (req, res) => {
  try {
      // Define the SQL query
      const query = 'SELECT * FROM printedmrp';

      // Execute the query
      const result = await pool.query(query);

      // Send the result as a JSON response
      res.status(200).json(result.rows);
  } catch (error) {
      // Handle errors and send a response
      console.error('Error fetching printed MRP data:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
};