const express = require('express');
const router = express.Router();
const controller = require('../controllers/pengajuanPermintaan.controller');
const verifyToken = require('../middleware/auth.middleware');

router.get('/', verifyToken, controller.getAll);
router.get('/lookup', verifyToken, controller.lookupPengajuan);
router.get('/:nomor', verifyToken, controller.getByNomor);
router.post('/', verifyToken, controller.save);
router.put('/:nomor', verifyToken, controller.save);
router.get('/print/:nomor', verifyToken, controller.getPengajuanForPrint);
router.post('/approve', verifyToken, controller.approvePengajuan);

module.exports = router;