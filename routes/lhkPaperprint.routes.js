const express = require('express');
const router = express.Router();
const lhkSublimController = require('../controllers/lhkPaperprint.controller');

// Mengambil list header (Browse) berdasarkan range tanggal
router.get('/', lhkSublimController.getLhkList);

// Mengambil nomor urut otomatis berikutnya
router.get('/next-number', lhkSublimController.getNextNumber);

// Mengambil full data (Header + Detail) untuk mode EDIT
router.get('/:nomor', lhkSublimController.getLhkFullData);

// Mengambil rincian detail saja berdasarkan nomor (untuk Expand row di tabel)
router.get('/detail/:nomor', lhkSublimController.getLhkDetails);

// Simpan data (Handle Create baru & Update data lama)
router.post('/', lhkSublimController.handleSaveLhk);

// Hapus data (Header & Detail)
router.delete('/:nomor', lhkSublimController.removeLhk);

// List History Approval (Browse)
router.get('/approval-history', lhkSublimController.getApprovalList);

// Detail History Approval (Expand Row)
router.get('/approval-history/detail/:nomor', lhkSublimController.getApprovalDetails);

module.exports = router;