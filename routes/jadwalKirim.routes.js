// backend/src/routes/jadwalKirim.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/jadwalKirim.controller');
const verifyToken = require('../middleware/auth.middleware');

// Proteksi semua route dengan middleware auth
router.use(verifyToken);

// Endpoint untuk menampilkan data (Browse)
router.get('/', controller.browseJadwal);

// Endpoint untuk menyimpan data (Insert/Update)
// Menggunakan POST karena ini adalah aksi pengiriman data form
router.post('/save', controller.saveJadwal);

// Endpoint untuk menghapus data
router.delete('/delete', controller.deleteJadwal);

module.exports = router;