const express = require('express');
const router = express.Router();
const tekstilController = require('../controllers/lapMonTekstil.controller');

// Endpoint: GET /api/mmt/monitoring-tekstil
// Anda bisa menyesuaikan prefix path di file utama app.js atau index.js
router.get('/', tekstilController.getMonitoringTekstil);
router.get('/tekstil', tekstilController.getMonitoringTekstil);
router.get('/monitoring', tekstilController.getMonitoringTekstil);

module.exports = router;