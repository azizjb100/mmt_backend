const express = require('express');
const router = express.Router();
// Pastikan path ke controller sudah benar!
const poCtrl = require('../controllers/poExtMmt.controller'); 

// Baris 12 (Pastikan poCtrl.browse ada di module.exports controller)
router.get('/browse', poCtrl.browse); 

router.delete('/delete/:nomor', poCtrl.remove);
router.post('/request-pin', poCtrl.submitPin);
router.get('/lookup-bpb', poCtrl.getLookupBpb);
router.get('/items-for-bpb/:nomor', poCtrl.getDetailForBpb);

module.exports = router;