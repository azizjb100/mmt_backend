// backend/src/routes/customer.routes.js

const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');

router.get('/browse', customerController.getBrowseCustomer);

// Endpoint: GET /api/customer/lookup?search=Budi
router.get('/lookup', customerController.getCustomerLookup);

// Endpoint: GET /api/customer/detail/CUST001
router.get('/detail/:kode', customerController.getCustomerByKode);

// --- 2. Action Routes ---
// Endpoint: POST /api/customer/save (Create)
// Endpoint: POST /api/customer/save?kodeToEdit=CUST001 (Update)
router.post('/save', customerController.saveCustomer);

// Endpoint: DELETE /api/customer/delete/CUST001
router.delete('/delete/:kode', customerController.deleteCustomer);

module.exports = router;