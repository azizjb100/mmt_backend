// backend/routes/lapLsBahanPenolong.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/lapLsBahanPenolong.controller');

// GET /api/reports/ls-bahan-penolong
router.get('/', controller.getReport);

module.exports = router;