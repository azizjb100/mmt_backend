const express = require('express');
const router = express.Router();
const poCtrl = require('../controllers/poExtMmt.controller'); 

// === 1. TARUH ENDPOINT STATIS DI PALING ATAS ===
router.get('/', poCtrl.browse); 
router.post('/save', poCtrl.save);
router.post('/submit-pin', poCtrl.submitPin);

// Jalur khusus Lookup BPB wajib di atas /:nomor
router.get('/lookup-bpb', poCtrl.getLookupBpb);
router.get('/detail/:nomor', poCtrl.getDetailForBpb); 
router.get('/sudah-terima/:nomor', poCtrl.getSudahTerima);


// === 2. TARUH ENDPOINT DINAMIS (/:nomor) DI PALING BAWAH ===
router.get('/check-pin/:nomor', poCtrl.checkPin);
router.get('/:nomor', poCtrl.getById); // <-- Sekarang "lookup-bpb" tidak akan terjebak di sini lagi
router.delete('/:nomor', poCtrl.remove);

module.exports = router;