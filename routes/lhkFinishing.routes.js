const express = require('express');
const router = express.Router();
const lhkController = require('../controllers/lhkFinishing.controller');
const praController = require('../controllers/praLhkFinishing.controller');

// ==========================================
// 1. ENDPOINT PRA-LHK (tpra_lhk_finishing)
// ==========================================
// Bagian ini menggunakan praController untuk mengelola data mentah lapangan

/**
 * POST /api/mmt/lhk-finishing/pra
 * Menyimpan hasil kerja operator ke tabel Pra-LHK (Draft)
 */
router.post('/pra', praController.saveDraft);

/**
 * GET /api/mmt/lhk-finishing/pra/unassigned
 * Mengambil daftar kerja yang belum di-bundling untuk ditarik ke LHK Final
 */
router.get('/pra/unassigned', praController.getUnassigned);

/**
 * DELETE /api/mmt/lhk-finishing/pra/:id
 * Menghapus baris draft kerja tertentu berdasarkan ID
 */
router.delete('/pra/:id', praController.deleteDraft);


// ==========================================
// 2. ENDPOINT LHK FINAL (hdr & dtl)
// ==========================================
// Bagian ini menggunakan lhkController untuk manajemen laporan resmi

/**
 * GET /api/mmt/lhk-finishing/
 * Mengambil daftar master laporan LHK Finishing (Header)
 */
router.get('/', lhkController.getAllHeaders);

/**
 * GET /api/mmt/lhk-finishing/details?nomor=...
 * Mengambil rincian SPK yang sudah terdaftar dalam satu nomor LHK
 */
router.get('/details', lhkController.getDetails);

/**
 * POST /api/mmt/lhk-finishing/finalize
 * Endpoint untuk memproses bundling: Memindahkan data dari tpra ke hdr & dtl
 */
router.post('/finalize', lhkController.processFinalize);

/**
 * DELETE /api/mmt/lhk-finishing/:nomor
 * Menghapus satu bundel laporan LHK resmi (Header & Detail)
 */
router.delete('/:nomor', lhkController.deleteHeader);

module.exports = router;