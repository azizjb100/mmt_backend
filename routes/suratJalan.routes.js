const express = require('express');
const router = express.Router();
const sjController = require('../controllers/suratJalan.controller');

// ==========================================
// RUTE KHUSUS LOOKUP / DATA FETCHING (Sinkron dengan Vue)
// ==========================================

// 1. Ambil Semua Master Data untuk List Grid 
// Query Params: ?startDate=...&endDate=...&cab=...&zcus=...&pendingOnly=...
router.get('/lookup', sjController.browseMasterSj);

// 2. Ambil Semua Detail Data untuk Grid Detail
// Query Params: ?startDate=...&endDate=...&cab=...&pendingOnly=...
router.get('/lookup/details', sjController.getDetailSj);


// ==========================================
// RUTE STANDAR ACTIONS (Proses Tombol Klik di Delphi)
// ==========================================
router.get('/', sjController.browseMasterSj);
router.get('/details', sjController.getDetailSj);

// Jalankan Approval1Click (Ubah status = 1, insert ke tsj_approve)
// Body: { "kodeGdg": "GJ002" } atau dikirim via path /approve/SJ-001
router.post('/approve', sjController.approveSj);
router.post('/approve/:nomor', sjController.approveSj); 

// Jalankan Pending1Click (Kembalikan status = 0, hapus dari tsj_approve)
router.post('/pending', sjController.pendingSj);
router.post('/pending/:nomor', sjController.pendingSj);

// Jalankan BatalSJ1Click (Ubah status = 2, potong spk_prasj)
router.post('/batal', sjController.batalSj);
router.post('/batal/:nomor', sjController.batalSj);

module.exports = router;