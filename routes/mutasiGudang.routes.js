const express = require('express');
const router = express.Router();
const mutasiController = require('../controllers/mutasiGudang.controller');

// Endpoint untuk mendapatkan nomor mutasi otomatis baru
router.get('/generate-nomor', mutasiController.generateNomor);

// Endpoint untuk mendapatkan daftar mutasi (Gunakan query params ?startDate=...&endDate=...)
router.get('/', mutasiController.getAllMutasi);

// Endpoint untuk simpan mutasi baru
router.post('/', mutasiController.createMutasi);

// Endpoint untuk update mutasi berdasarkan nomor
router.put('/:nomor', mutasiController.updateMutasi);

module.exports = router;