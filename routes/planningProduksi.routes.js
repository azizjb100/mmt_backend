// backend/src/routes/production.routes.js

const express = require('express');
const router = express.Router();
const planningController = require('../controllers/planningProduksi.controller');

// Endpoint: GET /api/production/planning-mmt?startDate=...&endDate=...
router.get('/planning-mmt', planningController.getBrowsePlanning);

// Endpoint: GET /api/production/planning-mmt/:nomor
router.get('/planning-mmt/:nomor', planningController.getDetailPlanning);

router.get('/load-spk/:nomor', planningController.getSpkDetailForPlanning);

// Menyimpan atau meng-update data planning spk mmt
router.post('/save', planningController.savePlanning);

module.exports = router;