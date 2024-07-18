const express = require('express');
const dispatchController = require('../controllers/dispatchController');
const authenticateToken = require('../controllers/middleware/authMiddleware')

const router = express.Router();

// Route for verifying SKU Code with corporate code and sku code
router.get('/:corporateCode/:skuCode', dispatchController.verifySKUCode);

// Route for saving dispatch data
router.post('/savedispatch', authenticateToken, dispatchController.createDispatch);

// Route for handling SKU code operations
router.get('/sku/:skuCode', dispatchController.getSKUInfo);

// Route to fetch dispatch data
router.get('/dispatches', dispatchController.getDispatches);

module.exports = router;
