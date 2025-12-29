// backend/src/routes/pabrik.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/lookupPabrik.controller');
const verifyToken = require('../middleware/auth.middleware');

router.get('/', verifyToken, controller.getLookup);

module.exports = router;