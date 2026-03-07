// backend/src/routes/returProduksi.routes.js

const express = require('express');
const router = express.Router();
const returController = require('../controllers/returProduksi.controller');

// Endpoint untuk scan barcode (GET /api/retur/scan?barcode=...&gudangAsal=...)
router.get('/scan', returController.scanBarcode);

// Endpoint untuk ambil nomor dokumen baru otomatis
router.get('/generate-nomor', returController.getNewNomor);

// Endpoint untuk simpan retur baru
router.post('/', returController.createRetur);

// Endpoint untuk update retur yang sudah ada
router.put('/:nomor', returController.updateRetur);

// Endpoint untuk hapus retur
router.delete('/:nomor', returController.deleteRetur);

module.exports = router;