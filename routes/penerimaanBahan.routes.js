// backend/src/routes/penerimaanBahan.routes.js
const express = require('express');
const router = express.Router();
const penerimaanBahanController = require('../controllers/penerimaanBahan.controller');

// --- 1. Route yang SANGAT Spesifik (Tanpa Parameter Dinamis di awal) ---
router.get('/lookup-invoice', penerimaanBahanController.lookupPenerimaan);
router.get('/detail-invoice/:nomor', penerimaanBahanController.getDetailPenerimaan);

router.get('/po/lookup', penerimaanBahanController.lookupPO);
router.get('/po/lookup/:nomor', penerimaanBahanController.getPODetail);

router.get('/check-edit/:nomor', penerimaanBahanController.checkEditStatus);
router.get('/barcodes/:nomor', penerimaanBahanController.getGeneratedBarcodes);

// ===============================
// ROUTE GENERAL (PALING BAWAH)
// ===============================
router.get('/', penerimaanBahanController.getRecMmt);
router.get('/:nomor', penerimaanBahanController.getRecMmtById);
router.post('/', penerimaanBahanController.saveRecMmt);
router.put('/:nomor', penerimaanBahanController.saveRecMmt);
router.delete('/:nomor', penerimaanBahanController.deleteRecMmt);

router.get('/print/:nomor', penerimaanBahanController.printPenerimaanBahan);

module.exports = router;