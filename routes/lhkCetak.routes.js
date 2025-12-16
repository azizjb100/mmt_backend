const express = require('express');
const router = express.Router();
const controller = require('../controllers/lhkCetak.controller');

// GET /api/mmt/lhk-cetak/
router.get('/', controller.getAllHeaders);

router.get('/lookup', controller.getAllHeaders);

// GET /api/mmt/lhk-cetak/details?nomor=...
router.get('/details', controller.getDetails);

// GET /api/mmt/lhk-cetak/lookup/:nomor
router.get('/lookup/:nomor', controller.getLookup);


router.delete('/:nomor', controller.deleteHeader);

router.post('/', controller.saveLhk);


module.exports = router;