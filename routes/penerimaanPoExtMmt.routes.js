const express = require('express');
const router = express.Router();
const controller = require('../controllers/penerimaanPoExtMmt.controller');

router.get('/', controller.browse);
router.get('/:nomor', controller.getById);
router.post('/', controller.save);
router.delete('/:nomor', controller.remove);

module.exports = router;