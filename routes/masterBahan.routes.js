// backend/src/routes/masterBahan.routes.js (atau lokasi sejenis)

const express = require('express');
const router = express.Router();
// Asumsi: Anda mengimpor controller seperti ini
const bahanController = require('../controllers/masterBahan.controller');

// Baris 9 yang menyebabkan error:
router.get('/', bahanController.getMasterBahan); 
// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Pastikan ini adalah fungsi yang valid

router.get('/mmt', bahanController.lookupBahan); 
router.get('/mmt/produksi', bahanController.lookupBahanProduksiMMt);
// Endpoint 2: Detail Tunggal (GET /api/master/bahan/:kode)
router.get('/mmt/:kode', bahanController.getBahanDetail);

module.exports = router;