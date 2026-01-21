// backend/src/routes/koreksiStokMmt.routes.js (CommonJS Style)

const express = require('express');
const router = express.Router();
const controller = require('../controllers/koreksiStokMmt.controller.js'); // Menggunakan require


router.get('/stok', controller.getStokGudangForKoreksi);
router.get(`/`, controller.getKoreksiStok);
router.get(`/detail`, controller.getKoreksiStokDetail);
router.delete(`/:nomor`, controller.deleteKoreksiStok);
router.post('/', controller.saveKoreksiStok);

module.exports = router; 