const express = require('express');
const router = express.Router();
const controller = require('../controllers/lhkFinishing.controller');

// GET /api/mmt/lhk-finishing/
router.get('/', controller.getAllHeaders);

// GET /api/mmt/lhk-finishing/details?nomor=...
router.get('/details', controller.getDetails);

// DELETE /api/mmt/lhk-finishing/:nomor
router.delete('/:nomor', controller.deleteHeader);

module.exports = router;