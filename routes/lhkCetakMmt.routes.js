// backend/routes/lhkCetak.routes.js
const express = require('express');
const router = express.Router();
const lhkCetakController = require('../controllers/lhkCetakMmt.controller');

// GET /api/mmt/lhk-cetak?startDate=...&endDate=...
// backend/routes/lhkCetak.routes.js

router.get('/', lhkCetakController.getAllHeaders);
router.get('/export', lhkCetakController.exportLhk);
router.get('/rekap', lhkCetakController.getRekapLhk);
router.get('/rekap-crosstab', lhkCetakController.getRekapCrossTab);
router.get('/rekap-detail-mesin', lhkCetakController.getDetailRekapMesin);

// PINDAHKAN INI KE BAWAH agar tidak bentrok dengan /export atau /rekap
router.get('/:nomor', lhkCetakController.getOneLhk);
router.get('/detail/:nomor', lhkCetakController.getDetails);

router.post('/', lhkCetakController.saveLhk);
router.put('/:nomor', lhkCetakController.saveLhk);
router.delete('/:nomor', lhkCetakController.deleteLhk);

module.exports = router;