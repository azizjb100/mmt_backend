// backend/src/routes/jadwalKirim.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/jadwalKirim.controller');
const verifyToken = require('../middleware/auth.middleware');



// Endpoint untuk menampilkan data (Browse)
router.get('/', verifyToken, controller.browseJadwal);

// Endpoint untuk menyimpan data (Insert/Update)
// Menggunakan POST karena ini adalah aksi pengiriman data form
router.post('/save', verifyToken, controller.saveJadwal);

// Endpoint untuk menghapus data
router.delete('/delete', verifyToken, controller.deleteJadwal);

module.exports = router;