// src/routes/lookup.routes.js
const express = require('express');
const router = express.Router();
// IMPOR DARI CONTROLLER DENGAN NAMA BARU
const lookupController = require('../controllers/lookupGdgMesin.controller'); 

// GET /api/v1/lookup/gudang
router.get('/gudang', lookupController.getGudangLookup);

// GET /api/v1/lookup/gudang/:kode
router.get('/gudang/:kode', lookupController.getGudangDetail);

// GET /api/v1/lookup/mesin
router.get('/mesin', lookupController.getMesinCetakLookup);

module.exports = router;