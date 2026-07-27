const express = require('express');
const router = express.Router();
const lhkController = require('../controllers/lhkFinishing.controller');
const praController = require('../controllers/praLhkFinishing.controller');
const verifyToken = require('../middleware/auth.middleware');

// ==========================================
// 1. ENDPOINT PRA-LHK (tpra_lhk_finishing)
// ==========================================

router.post('/pra', verifyToken, praController.saveDraft);
router.get('/pra/unassigned', verifyToken, praController.getUnassigned);
router.delete('/pra/:id', verifyToken, praController.deleteDraft);

/**
 * Ambil data SPK yang sudah dipotong tapi belum diproses di tahap selanjutnya.
 */
router.get('/pra/pending-potong', verifyToken, lhkController.getPendingPotong);


// ==========================================
// 2. ENDPOINT LHK FINAL (Laporan Resmi)
// ==========================================

router.get('/', verifyToken, lhkController.getAllHeaders);

// ROUTE BARU: Wajib diletakkan sebelum route ber-parameter dinamis (/:nomor)
router.get('/search-spk', verifyToken, lhkController.searchSpk);

router.get('/details', verifyToken, lhkController.getDetails);
router.post('/finalize', verifyToken, lhkController.processFinalize);

/**
 * ENDPOINT UPDATE (Hanya simpan perubahan, tanpa status ACC)
 */
router.post('/update', verifyToken, lhkController.updateLhk); 

/**
 * ENDPOINT ACC (Simpan perubahan + Isi kolom lfh_acc)
 */
router.post('/acc', verifyToken, lhkController.handleAcc); 

// Catatan: Route dengan parameter dinamis (/:nomor) SELALU ditaruh di paling bawah
router.delete('/:nomor', verifyToken, lhkController.deleteHeader);


module.exports = router;