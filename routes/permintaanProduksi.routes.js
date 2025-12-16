// backend/src/routes/permintaanProduksi.routes.js

const express = require('express');
const router = express.Router();
const ppController = require('../controllers/permintaanProduksi.controller');

// URL dasar: /api/mmt/permintaan-produksi

router.get('/', ppController.getPermintaanProduksi); 
router.delete('/:nomor', ppController.deletePermintaanProduksi);

router.post('/', ppController.savePermintaanProduksi); 

// 5. SAVE (Update)
// Contoh: PUT /api/mmt/permintaan-produksi
router.put('/', ppController.savePermintaanProduksi); 

// 6. DELETE
// Contoh: DELETE /api/mmt/permintaan-produksi/MTG.2511.0031
router.delete('/:nomor', ppController.deletePermintaanProduksi);

// ... Tambahkan POST/PUT/GET BY ID routes
module.exports = router;