const express = require('express');
const router = express.Router();
const controller = require('../controllers/recreateBarcode.controller');

router.get('/next-number', controller.getNextNumber);

// 2. Simpan banyak data sekaligus (saat klik "Simpan ke Database")
router.post('/save-batch', controller.saveBatch);

// Keep existing if needed
router.post('/generate', controller.generate);

router.get('/history', controller.getHistory);

module.exports = router;