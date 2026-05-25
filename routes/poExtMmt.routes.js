const express = require('express');
const router = express.Router();
const poCtrl = require('../controllers/poExtMmt.controller'); 

// Menyelaraskan dengan Axios Frontend: api.get("/mmt/po-external")
router.get('/', poCtrl.browse); 

router.post('/save', poCtrl.save);

router.get('/:nomor', poCtrl.getById);

// Menyelaraskan dengan Axios Frontend: api.delete("/mmt/po-external/:nomor")
router.delete('/:nomor', poCtrl.remove);

// Menyelaraskan dengan Axios Frontend: api.post("/mmt/po-external/submit-pin")
router.post('/submit-pin', poCtrl.submitPin);

// Menyelaraskan dengan Axios Frontend: api.get("/mmt/po-external/check-pin/:nomor")
router.get('/check-pin/:nomor', poCtrl.checkPin);

// Endpoint Tambahan untuk Lookup BPB
router.get('/lookup-bpb', poCtrl.getLookupBpb);
router.get('/detail/:nomor', poCtrl.getDetailForBpb); // Sesuai dengan api.get(`${API_URL}/detail/${lastNomor}`)
router.get('/sudah-terima/:nomor', poCtrl.getSudahTerima);
module.exports = router;
