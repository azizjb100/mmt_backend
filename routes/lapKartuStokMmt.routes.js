const express = require('express');
const router = express.Router();
const controller = require('../controllers/lapKartuStokMmt.controller');

router.get('/', controller.getSummary);

router.get('/detail', controller.getDetail);

module.exports = router;