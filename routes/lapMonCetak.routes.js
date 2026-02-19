// routes/lapMonCetak.routes.js

const express = require('express');
const router = express.Router();

// Pastikan nama file controller sesuai: lapMonCetak.controller.js
const lapMonCetakController = require('../controllers/lapMonCetak.controller'); 

router.get('/monitoring', lapMonCetakController.lapMonCetak);

module.exports = router;