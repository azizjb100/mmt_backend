const express = require('express');
const router = express.Router();
const returController = require('../controllers/returProduksi.controller');

// Endpoint untuk mendapatkan nomor otomatis baru
router.get('/generate-nomor', returController.getNewNomor);

// Endpoint untuk menyimpan retur baru
router.post('/', returController.createRetur);

// Endpoint untuk update retur berdasarkan nomor
router.put('/:nomor', returController.updateRetur);

// Endpoint untuk hapus retur berdasarkan nomor
router.delete('/:nomor', returController.deleteRetur);

module.exports = router;