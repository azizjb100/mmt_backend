const express = require('express');
const router = express.Router();
const finishingController = require('../controllers/lapMonFinishing.controller');

router.get('/', finishingController.getMonitoringFinishing);
router.get('/finishing', finishingController.getMonitoringFinishing);
router.get('/monitoring', finishingController.getMonitoringFinishing);

module.exports = router;