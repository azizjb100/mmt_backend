// backend/src/routes/penerimaanBahan.routes.js
const express = require('express');
const router = express.Router();
const penerimaanBahanController = require('../controllers/penerimaanBahan.controller');

// --- 1. Route yang SANGAT Spesifik (Tanpa Parameter Dinamis di awal) ---
router.get('/', penerimaanBahanController.getRecMmt);
router.get('/po/lookup', penerimaanBahanController.lookupPO); // Pindahkan ke atas

// --- 2. Route dengan Sub-Path Spesifik ---
router.get('/check-edit/:nomor', penerimaanBahanController.checkEditStatus);
router.get('/barcodes/:nomor', penerimaanBahanController.getGeneratedBarcodes);
router.get('/po/lookup/:nomor', penerimaanBahanController.getPODetail);

// --- 3. Route General dengan Parameter :nomor (Letakkan di bawah) ---
router.get('/:nomor', penerimaanBahanController.getRecMmtById);
router.post('/', penerimaanBahanController.saveRecMmt);
router.put('/:nomor', penerimaanBahanController.saveRecMmt);
router.delete('/:nomor', penerimaanBahanController.deleteRecMmt);

module.exports = router;