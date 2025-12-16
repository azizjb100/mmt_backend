// backend/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth.controller');


// POST /api/auth/login
router.post('/login', controller.login);

// POST /api/auth/register (Baru)
router.post('/register', controller.register);

// GET /api/auth/user-helpers (Baru)
router.get('/user-helpers', controller.getUserList);

router.get('/users', controller.getAllUsers);

module.exports = router;