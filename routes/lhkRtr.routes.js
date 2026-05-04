const express = require('express');
const router = express.Router();
const rtrController = require('../controllers/lhkRtr.controller');

router.get('/', rtrController.browseRtr);
router.get('/detail/:nomor', rtrController.getDetailRtr);
router.post('/', rtrController.saveRtr);
router.delete('/:nomor', rtrController.deleteRtr);

module.exports = router;