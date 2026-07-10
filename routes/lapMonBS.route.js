const express = require('express');
const router = express.Router();
const laporanBsController = require('../controllers/lapMonBS.controller');

// =========================================================================
// RUTE LAPORAN BARANG SISA (BS)
// =========================================================================

// GET /api/mmt/laporan-bs?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&type=ALL&gdgKode=...&search=...
router.get('/', laporanBsController.getLaporanBS);

module.exports = router;