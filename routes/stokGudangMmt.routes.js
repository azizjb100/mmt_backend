const express = require('express');
const router = express.Router();
const controller = require('../controllers/stokGudangMmt.controller');

// Endpoint untuk scan barcode di form LHK / Permintaan Produksi
router.get('/:barcode', controller.checkBarcodeStok);

module.exports = router;