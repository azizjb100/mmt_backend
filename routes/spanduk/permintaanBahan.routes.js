const express = require('express');
const router = express.Router();

// Path disesuaikan keluar dari /routes/spanduk menuju folder controllers
const garmenController = require('../../controllers/spanduk/permintaanBahan.controller');

// GET: /api/minta-garmen/browse
// Contoh pemanggilan: /api/minta-garmen/browse?startDate=2026-07-01&endDate=2026-07-17&jenis=SPAREPART&cab=P01
router.get('/browse', garmenController.getPermintaanGarmen);

module.exports = router;