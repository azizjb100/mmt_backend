const express = require('express');
const router = express.Router();
const controller = require('../controllers/lhkMesinCetak.controller');
const verifyToken = require('../middleware/auth.middleware');

// Pastikan controller.namaFungsi TIDAK undefined
// Cek baris demi baris:

// 1. Ambil semua header
router.get('/', verifyToken, controller.getAllHeaders);

router.get('/lookup', verifyToken, controller.getAllHeaders);

// 2. Lookup untuk modal (Gunakan fungsi yang sama atau berbeda)
router.get('/lookup/:nomor', verifyToken, controller.getLookupByNomor);

// 3. Detail untuk Edit (Single)
router.get('/details', verifyToken, controller.getDetails);


router.get('/detail-lookup', verifyToken, controller.getDetailForLookup);

router.post('/', verifyToken, controller.saveLhk);

// 6. Hapus (DELETE)
router.delete('/:nomor', verifyToken, controller.deleteHeader);

router.get('/report/dashboard', verifyToken, controller.getDashboardAgregasi);

// Untuk Tabel Rekap Produksi
router.get('/rekap', verifyToken, controller.getReportRekap);
router.get('/rekap-detail-mesin', verifyToken, controller.getDetailRekapPerMesin);

// Untuk Export Excel CrossTab (Mesin vs Tanggal)
router.get('/report/export-crosstab', verifyToken, controller.getExcelCrossTab);

// Untuk Export Detail Raw Data
router.get('/report/export-detail', verifyToken, controller.getExportLhk)

module.exports = router;