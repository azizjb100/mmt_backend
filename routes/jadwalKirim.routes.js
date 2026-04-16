// backend/src/routes/jadwalKirim.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/jadwalKirim.controller');
const verifyToken = require('../middleware/auth.middleware');

// Proteksi semua route dengan middleware auth
router.use(verifyToken);

// Endpoint untuk menampilkan data (Browse)
router.get('/', controller.browseJadwal);

// Endpoint untuk menghapus data
// Catatan: Menggunakan POST atau DELETE dengan body karena primary key komposit
router.delete('/delete', controller.deleteJadwal);

module.exports = router;