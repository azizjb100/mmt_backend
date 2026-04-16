const express = require('express');
const router = express.Router();
const finishingController = require('../controllers/lapMonFinishing.controller');

router.get('/', finishingController.getMonitoringFinishing);

module.exports = router;