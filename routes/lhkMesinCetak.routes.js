const express = require('express');
const router = express.Router();
const controller = require('../controllers/lhkMesinCetak.controller');
const verifyToken = require('../middleware/auth.middleware');

// GET /api/mmt/lhk-cetak/
router.get('/', verifyToken, controller.getAllHeaders);

router.get('/lookup', verifyToken, controller.getAllHeaders);

// GET /api/mmt/lhk-cetak/details?nomor=...
router.get('/details', verifyToken, controller.getDetails);

// GET /api/mmt/lhk-cetak/lookup/:nomor
router.get('/lookup/:nomor', verifyToken, controller.getLookup);


router.delete('/:nomor', verifyToken, controller.deleteHeader);

router.post('/', verifyToken, controller.saveLhk);


module.exports = router;