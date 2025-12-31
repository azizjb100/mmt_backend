const express = require('express');
const router = express.Router();
const lmkpController = require('../controllers/lapLmkpMmt.controller');

// Endpoint: GET /api/laporan/lmkp?jenisIndex=0&startDate=2023-01-01&endDate=2023-01-31
router.get('/lmkp', lmkpController.getLaporan);

module.exports = router;