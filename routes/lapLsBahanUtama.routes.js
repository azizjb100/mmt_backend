// backend/routes/lapLsBahanBaku.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/lapLsBahanUtama.controller');

// GET /api/reports/ls-bahan-baku
router.get('/', controller.getReport);

module.exports = router;