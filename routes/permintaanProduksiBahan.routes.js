const express = require('express');
const router = express.Router();
const controller = require('../controllers/permintaanProduksiBahan.controller');

// GET /api/mmt/permintaan-produksi-bahan?startDate=...&endDate=...
router.get('/', controller.getBrowse);

// POST /api/mmt/permintaan-produksi-bahan
router.post('/', controller.save);

// DELETE /api/mmt/permintaan-produksi-bahan/:nomor
router.delete('/:nomor', controller.remove);

module.exports = router;