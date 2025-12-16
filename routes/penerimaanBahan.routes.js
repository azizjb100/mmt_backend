// backend/src/routes/penerimaanBahan.routes.js

const express = require('express');
const router = express.Router();
// KOREKSI UTAMA: Gunakan nama file yang konsisten
const penerimaanBahanController = require('../controllers/penerimaanBahan.controller');


router.get('/', penerimaanBahanController.getRecMmt);

// 2. GET SINGLE (Load data untuk Edit/loaddataall)
router.get('/:nomor', penerimaanBahanController.getRecMmtById);

// 3. CHECK STATUS (Validasi sebelum membuka Edit)
router.get('/check-edit/:nomor', penerimaanBahanController.checkEditStatus);

// 4. CREATE (Baru)
router.post('/', penerimaanBahanController.saveRecMmt);

// 5. UPDATE (Ubah)
router.put('/:nomor', penerimaanBahanController.saveRecMmt);

// 6. DELETE (Hapus)
router.delete('/:nomor', penerimaanBahanController.deleteRecMmt);

// Route untuk modal lookup PO
router.get('/po/lookup', penerimaanBahanController.lookupPO);

// Route untuk mengambil detail PO lengkap setelah pemilihan
router.get('/po/lookup/:nomor', penerimaanBahanController.getPODetail);

module.exports = router;