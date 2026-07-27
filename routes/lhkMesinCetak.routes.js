const express = require('express');
const router = express.Router();
const controller = require('../controllers/lhkMesinCetak.controller');
const verifyToken = require('../middleware/auth.middleware');

// 1. ROUTE UTAMA & POST
router.get('/', verifyToken, controller.getAllHeaders);
router.post('/', verifyToken, controller.saveLhk);

// 2. ROUTE STATIS / LOOKUP (Ditaruh sebelum route yang pakai parameter :nomor)
router.get('/lookup', verifyToken, controller.getLookup);
router.get('/details', verifyToken, controller.getDetails);
router.get('/detail-lookup', verifyToken, controller.getDetailForLookup);

// 3. ROUTE LAPORAN & REKAP
router.get('/rekap', verifyToken, controller.getReportRekap);
router.get('/rekap-detail-mesin', verifyToken, controller.getDetailRekapPerMesin);
router.get('/report/dashboard', verifyToken, controller.getDashboardAgregasi);
router.get('/report/export-crosstab', verifyToken, controller.getExcelCrossTab);
router.get('/report/export-detail', verifyToken, controller.getExportLhk);

// 4. ROUTE DINAMIS PARAMETER (HARUS DI PALING BAWAH)
router.get('/lookup/:nomor', verifyToken, controller.getLookupByNomor);
router.delete('/:nomor', verifyToken, controller.deleteHeader);

module.exports = router;