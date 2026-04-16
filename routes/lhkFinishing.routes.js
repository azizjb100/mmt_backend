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
 * NEW: Ambil data SPK yang sudah dipotong tapi belum diproses di tahap selanjutnya.
 * GET /api/mmt/lhk-finishing/pra/pending-potong?targetProses=SEAMING
 */
router.get('/pra/pending-potong', verifyToken, lhkController.getPendingPotong);


// ==========================================
// 2. ENDPOINT LHK FINAL (Laporan Resmi)
// ==========================================

router.get('/', verifyToken, lhkController.getAllHeaders);
router.get('/details', verifyToken, lhkController.getDetails);
router.post('/finalize', verifyToken, lhkController.processFinalize);

/**
 * ENDPOINT ACC (Finalisasi & Verifikasi Supervisor)
 * POST /api/mmt/lhk-finishing/acc
 * Digunakan untuk simpan perubahan detail sekaligus mengisi kolom lfh_acc
 */
router.post('/acc', verifyToken, lhkController.handleAcc); // <--- Tambahkan ini

router.delete('/:nomor', verifyToken, lhkController.deleteHeader);

module.exports = router;