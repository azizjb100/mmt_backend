const express = require('express');
const router = express.Router();
const controller = require('../controllers/permintaanProduksiBahan.controller');
const verifyToken = require('../middleware/auth.middleware');

// --- Route List & Lookup (Statis) ---
router.get('/', verifyToken, controller.getBrowse);
router.get('/lookup', verifyToken, controller.getLookupPermintaan); 

// --- Route Action ---
router.post('/', verifyToken, controller.save);

// --- Route Detail & Delete (Dinamis dengan Parameter) ---
// Letakkan paling bawah agar 'lookup/history' tidak dianggap sebagai ':nomor'
router.get('/:nomor', verifyToken, controller.getDetailByNomor); 
router.delete('/:nomor', verifyToken, controller.remove);

module.exports = router;