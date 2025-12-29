// backend/src/routes/permintaanProduksi.routes.js

const express = require('express');
const router = express.Router();
const ppController = require('../controllers/permintaanProduksi.controller');

// URL dasar: /api/mmt/permintaan-produksi

// 1. SCAN BARCODE (PENTING: Harus diletakkan di paling atas sebelum rute berparameter umum)
// Menggunakan regex (.+) untuk menangkap seluruh string barcode yang mengandung tanda hubung (-)
router.get('/stok-barcode/:barcode', ppController.getStokByBarcode);

// 2. READ ALL (Browse)
router.get('/', ppController.getPermintaanProduksi);

// 3. SAVE (Baru)
router.post('/', ppController.savePermintaanProduksi);

// 4. SAVE (Update)
router.put('/', ppController.savePermintaanProduksi);

// 5. DELETE
// Diletakkan di bawah agar tidak bentrok dengan rute 'stok-barcode'
router.delete('/:nomor', ppController.deletePermintaanProduksi);

module.exports = router;