// backend/src/routes/koreksiStokMmt.routes.js (CommonJS Style)

const express = require('express');
const router = express.Router();
const controller = require('../controllers/koreksiStokMmt.controller.js'); // Menggunakan require



router.get(`/`, controller.getKoreksiStok);
router.get(`/:nomor`, controller.getKoreksiStokDetail);
router.delete(`/:nomor`, controller.deleteKoreksiStok);

module.exports = router; // Menggunakan module.exports