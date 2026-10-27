const express = require('express');
const router = express.Router();
const controller = require('../controllers/sjHasilMaklon.controller');
const verifyToken = require('../middleware/auth.middleware');

router.get('/outstanding', verifyToken, controller.getOutstanding);
router.get('/available-maklon', verifyToken, controller.getAvailableMaklon);
router.get('/history', verifyToken, controller.getHistory);
router.get('/history/:nomor/detail', verifyToken, controller.getHistoryDetail);
router.get('/create-data', verifyToken, controller.getCreateData);
router.get('/print/:nomor', verifyToken, controller.getPrintData);
router.post('/save', verifyToken, controller.create);

module.exports = router;
