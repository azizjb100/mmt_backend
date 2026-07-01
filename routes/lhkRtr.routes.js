const express = require('express');
const router = express.Router();
const rtrController = require('../controllers/lhkRtr.controller');

// ==========================================
// RUTE KHUSUS LOOKUP (Sinkron dengan Vue)
// ==========================================

// 1. Ambil Semua Header untuk Lookup List (?startDate=...&endDate=...)
router.get('/lookup', rtrController.browseRtr);

// 2. Ambil Detail (?nomor=...)
router.get('/lookup/details', rtrController.getDetailRtr);


// ==========================================
// RUTE STANDAR CRUD (Bawaan Form Entry)
// ==========================================
router.get('/', rtrController.browseRtr);
router.get('/detail/:nomor', rtrController.getDetailRtr); // Pendekatan Path parameter tetap aman

router.post('/', rtrController.saveRtr);                   // Insert Baru (AUTO)
router.post('/:nomor', rtrController.saveRtr);             // Update Data Lama
router.delete('/:nomor', rtrController.deleteRtr);         // Delete

module.exports = router;