const express = require('express');
const mrpController = require('../controllers/mrpController');
const authenticateToken = require('../controllers/middleware/authMiddleware')

const router = express.Router();

router.post('/upload-chunk', mrpController.uploadChunk);
router.get('/get-data', mrpController.getData);
router.get('/get-data-by-id', mrpController.getDataById);
router.get('/getprintedmrp', mrpController.getPrintedMrp);
//router.post('/saveprintdetails', authenticateToken, mrpController.createPrintDetails);
router.post('/saveprintdetails', authenticateToken, (req, res, next) => {
    console.log('Hit /saveprintdetails');
    next();
}, mrpController.createPrintDetails);
// router.get('/:corporateCode', productController.getProductByCorporateCode); // Get a specific product
// router.put('/update/:corporateCode', productController.updateProduct); // PUT route for updating a product


// Define the route for deleting a product by corporateCode
router.delete('/:id', mrpController.deleteProduct);


module.exports = router;
