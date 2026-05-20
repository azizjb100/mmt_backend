// backend/src/routes/mppb.routes.js
const express = require('express');
const router = express.Router();
const mppbController = require('../controllers/mppb.controller');

// Route untuk Modal Lookup MPPB
router.get('/lookup', mppbController.getMPPBLookup);
router.get('/:nomor', mppbController.getMPPBByNomor);

module.exports = router;