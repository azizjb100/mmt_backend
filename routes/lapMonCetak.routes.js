// routes/lapMonCetak.routes.js

const express = require('express');
const router = express.Router();

// --- Perbaikan di sini: Sesuaikan nama file controller yang benar ---
// Node.js akan mencari file bernama 'lapMonCetak.controller.js'
const lapMonCetakController = require('../controllers/lapMonCetak.controller'); 
// -------------------------------------------------------------------

// Endpoint: GET /api/reports/monitoring (asumsi endpoint utama Anda)
router.get('/monitoring', lapMonCetakController.lapMonCetak);

module.exports = router;