// backend/routes/lapLsBahanBaku.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/lapLsBahanUtama.controller');

// GET /api/reports/ls-bahan-baku
router.get('/', controller.getReport);

router.get('/total-roll', controller.getTotalRoll);
router.get('/list-gudang', controller.getGudangList);

module.exports = router;