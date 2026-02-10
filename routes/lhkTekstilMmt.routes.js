const express = require('express');
const router = express.Router();
const lhkController = require('../controllers/lhkTekstilMmt.controller');

router.get('/', lhkController.getLhkList);
router.get('/detail/:nomor', lhkController.getLhkDetails);
router.delete('/:nomor', lhkController.removeLhk);

module.exports = router;