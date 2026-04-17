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
router.get('/details', verifyToken, lhkController.getDetails);
router.post('/finalize', verifyToken, lhkController.processFinalize);

/**
 * ENDPOINT UPDATE (Hanya simpan perubahan, tanpa status ACC)
 * POST /api/mmt/lhk-finishing/update
 * Diubah ke POST agar sinkron dengan api.post di frontend Vue kamu
 */
router.post('/update', verifyToken, lhkController.updateLhk); 

/**
 * ENDPOINT ACC (Simpan perubahan + Isi kolom lfh_acc)
 * POST /api/mmt/lhk-finishing/acc
 */
router.post('/acc', verifyToken, lhkController.handleAcc); 

router.delete('/:nomor', verifyToken, lhkController.deleteHeader);


module.exports = router;