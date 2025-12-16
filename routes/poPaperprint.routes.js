// backend/routes/poPaperprint.routes.js (Diperbaiki)

const express = require('express');
const router = express.Router();
// Pastikan path ini benar:
const controller = require('../controllers/poPaperprint.controller.js'); 

router.get(`/`, controller.getPoPaperprint);

// GET /api/mmt/paperprint/detail?nomor=...
// Menggantikan router.get('/detail') di file Anda
router.get(`/detail`, controller.getPoPaperprintDetail);

// DELETE /api/mmt/paperprint/:nomor
// Menggantikan router.delete('/:nomor') di file Anda
router.delete(`/:nomor`, controller.deletePoPaperprint);

module.exports = router;