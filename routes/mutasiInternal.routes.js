const express = require('express');
const router = express.Router();
const mutasiInternalController = require('../controllers/mutasiInternal.controller');

// Endpoint nomor otomatis baru
router.get('/generate-nomor', mutasiInternalController.generateNomor);

// Endpoint data detail (untuk expand row di tabel & edit view)
router.get('/detail/:nomor', mutasiInternalController.getDetailMutasi);

// Endpoint master list data mutasi (?startDate=...&endDate=...)
router.get('/', mutasiInternalController.getAllMutasi);

// Endpoint simpan mutasi internal baru
router.post('/', mutasiInternalController.createMutasi);

// Endpoint update mutasi internal
router.put('/:nomor', mutasiInternalController.updateMutasi);

// Endpoint hapus & refund stok
router.delete('/:nomor', mutasiInternalController.deleteMutasi);

module.exports = router;