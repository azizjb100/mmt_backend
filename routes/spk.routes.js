// backend/src/routes/spk.routes.js

const express = require('express');
const router = express.Router();
const spkController = require('../controllers/spk.controller');

router.get('/lookup', spkController.getSpkLookup);


router.get('/:nomor', spkController.getSpkDetail);

module.exports = router;