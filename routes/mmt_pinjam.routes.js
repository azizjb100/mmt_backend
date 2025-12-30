const express = require('express');
const router = express.Router();
const MmtController = require('../controllers/mmt_pinjam.controller');

// Route untuk mengirim permintaan pinjam (dipanggil saat scan di LHK)
router.post('/', MmtController.handleRequestPinjam);

// Route untuk melihat daftar pinjaman (dipanggil untuk notifikasi di Permintaan Produksi)
router.get('/', MmtController.getPendingLoans);

router.post('/approve-pinjam', MmtController.handleApprovePinjam);

module.exports = router;