// backend/src/routes/permintaanBahan.routes.js

const express = require('express');
const router = express.Router();
const permintaanBahanController = require('../controllers/permintaanBahan.controller');
const verifyToken = require('../middleware/auth.middleware'); // <--- 1. Import Middleware Autentikasi

// --- MIDDLEWARE ---
// Anda bisa memasang middleware di level router jika SEMUA route di bawah ini harus login
// router.use(verifyToken); 

// --- ROUTES ---

// READ ALL (Gunakan verifyToken agar hanya user terdaftar yang bisa melihat data)
router.get('/', verifyToken, permintaanBahanController.getPermintaanBahan);
router.get('/lookup', verifyToken, permintaanBahanController.lookupPermintaanBahan);

router.get('/:nomor', verifyToken, permintaanBahanController.getPermintaanBahanByNomor);

// DELETE (Sangat krusial menggunakan verifyToken untuk keamanan data)
router.delete('/:nomor', verifyToken, permintaanBahanController.deletePermintaanBahan);

// SAVE (POST/PUT) 
// verifyToken wajib ada di sini agar req.user tersedia di controller
router.post('/', verifyToken, permintaanBahanController.savePermintaanBahan);
router.put('/:nomor', verifyToken, permintaanBahanController.savePermintaanBahan);

// APPROVE
router.post('/approve', verifyToken, permintaanBahanController.approvePermintaan);

// PRINT
router.get('/print/:nomor', verifyToken, permintaanBahanController.getPermintaanBahanForPrint);

module.exports = router;