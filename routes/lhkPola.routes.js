// backend/routes/lhkPola.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const lhkPolaController = require('../controllers/lhkPola.controller');

// --- KONFIGURASI MULTER STORAGE ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads/pola';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'POLA-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 } // Limit berkas gambar 2MB per baris
});

// Mapping slot upload dinamis untuk mencocokkan indeks array data table frontend (images_0, images_1, dst.)
const dynamicFieldsUpload = upload.fields([
    ...Array.from({ length: 30 }).map((_, i) => ({ name: `images_${i}`, maxCount: 1 }))
]);

// =========================================================================
// RUTE LHK POLA MMT
// =========================================================================

// GET /api/mmt/lhk-pola?startDate=...&endDate=...&search=...
router.get('/', lhkPolaController.getAllHeaders);
router.get('/export', lhkPolaController.exportLhk);
router.get('/rekap', lhkPolaController.getRekapLhk);

// PINDAHKAN PARAMETER DI BAWAH agar tidak bentrok dengan /export atau /rekap
router.get('/:nomor', lhkPolaController.getOneLhk);
router.get('/detail/:nomor', lhkPolaController.showDetailsPola); // Dipakai di onMounted frontend Anda

// POST & PUT (Menggunakan middleware upload gambar biner dinamis)
router.post('/', dynamicFieldsUpload, lhkPolaController.storeLhkPola);
router.put('/:nomor', dynamicFieldsUpload, lhkPolaController.storeLhkPola);

router.delete('/:nomor', lhkPolaController.deleteLhk);

module.exports = router;