const express = require('express');
const router = express.Router();
// Perbaikan path: menggunakan ../../ untuk keluar dari /routes/spanduk
const mutasiController = require('../../controllers/spanduk/mutasiBahan.controller');

// GET: /api/mutasi-bahan/browse
router.get('/browse', mutasiController.getMutasiBahan);

// GET: /api/mutasi-bahan/report-penawaran
router.get('/report-penawaran', mutasiController.getReportPenawaran);

module.exports = router;