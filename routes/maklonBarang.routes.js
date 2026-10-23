const express = require('express');
const router = express.Router();
const controller = require('../controllers/maklonBarang.controller');
const verifyToken = require('../middleware/auth.middleware');

// Browse, detail, print, lookup
router.get('/browse', verifyToken, controller.getBrowse);
router.get('/detail/:nomor', verifyToken, controller.getDetail);
router.get('/print/:nomor', verifyToken, controller.getPrintData);
router.get('/sj-keluar/print/:sjkNomor', verifyToken, controller.getSjKeluarPrintData);
router.get('/lookup', verifyToken, controller.getLookup);

module.exports = router;
