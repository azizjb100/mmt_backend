const express = require('express');
const router = express.Router();
const controller = require('../controllers/stbjMmt.controller');

// GET /api/mmt/laporan-brg-jadi/
router.get('/', controller.getReport);

module.exports = router;