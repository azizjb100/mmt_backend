// backend/routes/lhkCetak.routes.js
const express = require('express');
const router = express.Router();
const lhkCetakController = require('../controllers/lhkCetakMmt.controller');

// GET /api/mmt/lhk-cetak?startDate=...&endDate=...
router.get('/', lhkCetakController.getAllHeaders);

// GET /api/mmt/lhk-cetak/details?nomor=...
router.get('/details', lhkCetakController.getDetails);

// POST /api/mmt/lhk-cetak (Simpan Baru)
router.post('/', lhkCetakController.saveLhk);

// PUT /api/mmt/lhk-cetak/:nomor (Update/Edit)
router.put('/:nomor', lhkCetakController.saveLhk);

// DELETE /api/mmt/lhk-cetak/:nomor (Hapus)
router.delete('/:nomor', lhkCetakController.deleteLhk);

module.exports = router;