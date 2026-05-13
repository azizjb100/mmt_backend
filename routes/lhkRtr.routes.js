const express = require('express');
const router = express.Router();
const rtrController = require('../controllers/lhkRtr.controller');

router.get('/', rtrController.browseRtr);
router.get('/detail/:nomor', rtrController.getDetailRtr);
router.post('/', rtrController.saveRtr); // Untuk data baru (nomor AUTO)
router.post('/:nomor', rtrController.saveRtr);
router.delete('/:nomor', rtrController.deleteRtr);

module.exports = router;