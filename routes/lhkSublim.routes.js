const express = require('express');
const router = express.Router();
const sublimController = require('../controllers/lhkSublim.controller');

// ==========================================
// RUTE KHUSUS LOOKUP (Sinkron dengan Vue)
// ==========================================

// 1. Ambil Semua Header untuk Lookup List (?startDate=...&endDate=...)
router.get('/lookup', sublimController.browseSublim);

// 2. Ambil Detail (?nomor=...)
router.get('/lookup/details', sublimController.getDetailSublim);


// ==========================================
// RUTE STANDAR CRUD (Bawaan Form Entry)
// ==========================================
router.get('/', sublimController.browseSublim);
router.get('/detail/:nomor', sublimController.getDetailSublim); // Pendekatan Path parameter tetap aman

router.post('/', sublimController.saveSublim);                   // Insert Baru (AUTO)
router.post('/:nomor', sublimController.saveSublim);             // Update Data Lama
router.delete('/:nomor', sublimController.deleteSublim);         // Delete

module.exports = router;