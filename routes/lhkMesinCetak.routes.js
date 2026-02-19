const express = require('express');
const router = express.Router();
const controller = require('../controllers/lhkMesinCetak.controller');
const verifyToken = require('../middleware/auth.middleware');

// Pastikan controller.namaFungsi TIDAK undefined
// Cek baris demi baris:

// 1. Ambil semua header
router.get('/', verifyToken, controller.getAllHeaders);

// 2. Lookup untuk modal (Gunakan fungsi yang sama atau berbeda)
router.get('/lookup', verifyToken, controller.getAllHeaders);

// 3. Detail untuk Edit (Single)
router.get('/details', verifyToken, controller.getDetails);

// 4. Detail untuk Multiple Lookup (Fungsi yang kita perbaiki tadi)
// Pastikan di controller namanya: getDetailForLookup
router.get('/detail-lookup', verifyToken, controller.getDetailForLookup);

// 5. Simpan (POST)
router.post('/', verifyToken, controller.saveLhk);

// 6. Hapus (DELETE)
router.delete('/:nomor', verifyToken, controller.deleteHeader);

module.exports = router;