const express = require('express');
const router = express.Router();
const controller = require('../controllers/jadwalKirim.controller');
const verifyToken = require('../middleware/auth.middleware');

// Endpoint untuk menampilkan data (Browse)
router.get('/', verifyToken, controller.browseJadwal);

// Endpoint untuk mencetak data (Laporan)
// Ditempatkan sebelum /save agar tidak tertukar dengan route dinamis jika ada
router.get('/print', verifyToken, controller.printJadwal);

// Endpoint untuk menyimpan data (Insert/Update)
router.post('/save', verifyToken, controller.saveJadwal);

// Endpoint untuk menghapus data
router.delete('/delete', verifyToken, controller.deleteJadwal);

module.exports = router;