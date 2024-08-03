const express = require('express');
const gnController = require('../controllers/gnController');

const router = express.Router();

router.post('/upload-chunk', gnController.uploadChunk);
router.get('/get-data', gnController.getData);
// router.get('/:corporateCode', productController.getProductByCorporateCode); // Get a specific product
// router.put('/update/:corporateCode', productController.updateProduct); // PUT route for updating a product


// Define the route for deleting a product by corporateCode
//router.delete('/:corporateCode', productController.deleteProduct);

module.exports = router;