// routes/lhkTekstilMmt.route.js
const express = require('express');
const router = express.Router();
const lhkController = require('../controllers/lhkTekstilMmt.controller');

// Ambil semua list header berdasarkan range tanggal
router.get('/', lhkController.getLhkList);
router.get('/lookup', lhkController.getLhkLookup);


router.get('/:nomor', lhkController.getLhkFullData);

// Ambil detail berdasarkan nomor LHK
router.get('/detail/:nomor', lhkController.getLhkDetails);

// Ambil data untuk lookup

router.post('/approve', lhkController.handleSaveApproval);
// Simpan data (Handle Create baru & Update data lama)
router.post('/', lhkController.handleSaveLhk);

// Hapus data
router.delete('/:nomor', lhkController.removeLhk);

module.exports = router;