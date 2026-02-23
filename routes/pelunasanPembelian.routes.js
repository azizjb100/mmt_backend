const express = require('express');
const router = express.Router();
const controller = require('../controllers/pelunasanPembelian.controller');
const verifyToken = require('../middleware/auth.middleware');


// GET /api/mmt/pelunasan?startDate=...&endDate=...
router.get('/', verifyToken, controller.getPelunasanList);

// GET /api/mmt/pelunasan/next-nomor?kodePerush=KP&tanggal=2026-02-20
router.get('/next-nomor', verifyToken, controller.getNextNomor);

// GET /api/mmt/pelunasan/outstanding/:supKode
router.get('/outstanding/:supKode', verifyToken, controller.getOutstanding);

router.get('/outstanding-global', verifyToken, controller.getOutstandingGlobal);

router.get('/rekap-hutang', verifyToken, controller.getRekapHutang);

// POST /api/mmt/pelunasan/save
router.post('/save', verifyToken, controller.savePelunasan);

module.exports = router;