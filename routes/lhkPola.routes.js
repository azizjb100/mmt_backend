// backend/src/routes/lhkPola.routes.js
const express = require('express');
const router = express.Router();
const lhkPolaController = require('../controllers/lhkPola.controller');

// Route untuk Modal Lookup (Digunakan di LHK Desain)
router.get('/lookup', lhkPolaController.getLHKPolaLookup);

module.exports = router;