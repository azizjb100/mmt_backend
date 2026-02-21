const express = require('express');
const router = express.Router();
const controller = require('../controllers/pelunasanPembelian.controller');

// GET /api/mmt/pelunasan/next-nomor?kodePerush=KP&tanggal=2026-02-20
router.get('/next-nomor', controller.getNextNomor);

// GET /api/mmt/pelunasan/outstanding/:supKode
router.get('/outstanding/:supKode', controller.getOutstanding);

// POST /api/mmt/pelunasan/save
router.post('/save', controller.savePelunasan);

module.exports = router;