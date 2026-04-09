const express = require('express');
const router = express.Router();
const lhkController = require('../controllers/lhkFinishing.controller');
const praController = require('../controllers/praLhkFinishing.controller');

// ==========================================
// 1. ENDPOINT PRA-LHK (tpra_lhk_finishing)
// ==========================================

router.post('/pra', praController.saveDraft);
router.get('/pra/unassigned', praController.getUnassigned);
router.delete('/pra/:id', praController.deleteDraft);

/**
 * NEW: Ambil data SPK yang sudah dipotong tapi belum diproses di tahap selanjutnya.
 * GET /api/mmt/lhk-finishing/pra/pending-potong?targetProses=SEAMING
 */
router.get('/pra/pending-potong', lhkController.getPendingPotong);


// ==========================================
// 2. ENDPOINT LHK FINAL (Laporan Resmi)
// ==========================================

router.get('/', lhkController.getAllHeaders);
router.get('/details', lhkController.getDetails);
router.post('/finalize', lhkController.processFinalize);
router.delete('/:nomor', lhkController.deleteHeader);

module.exports = router;