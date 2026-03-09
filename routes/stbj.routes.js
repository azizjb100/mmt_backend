// backend/src/routes/stbj.routes.js

const express = require('express');
const router = express.Router();
const stbjController = require('../controllers/stbj.controller');
// const auth = require('../middleware/auth'); // Aktifkan jika ada sistem login
// Route untuk Browse (Master)
router.get('/', stbjController.browseSTBJ);

// Route untuk Detail (Sub-grid)
router.get('/browse/detail/:nomor', stbjController.getDetail);

// Route untuk Simpan Baru
router.post('/', stbjController.createSTBJ);

// Route untuk Update (Edit)
router.put('/:nomor', stbjController.updateSTBJ);

// Route untuk Hapus
router.delete('/:nomor', stbjController.deleteSTBJ);

module.exports = router;