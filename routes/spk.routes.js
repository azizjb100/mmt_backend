// backend/src/routes/spk.routes.js
const express = require('express');
const router = express.Router();
const spkController = require('../controllers/spk.controller');

// GET /api/mmt/spk/browse
router.get('/browse', spkController.getSpkBrowse);

// GET /api/mmt/spk/lookup
router.get('/lookup', spkController.getSpkLookup);

// GET /api/mmt/spk/detail-size/:nomor
router.get('/detail-size/:nomor', spkController.getSpkDetailSize);

// GET /api/mmt/spk/:nomor
router.get('/:nomor', spkController.getSpkDetail);

router.get('/print/:nomor', spkController.printSpk);

module.exports = router;