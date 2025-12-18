// backend/src/routes/poMmtRoutes.js

// Menggunakan require untuk semua import (CommonJS)
const express = require('express');
const router = express.Router();

// Asumsi: Nama file controller yang benar adalah poMmt.controller.js
// Sesuaikan path jika controller Anda berada di lokasi lain
const controller = require('../controllers/poBahanMmt.controller'); 


// 1. GET /api/mmt/po-bahan/ (Browse/Filter)
router.get('/', controller.browsePO); 

router.get('/detail', controller.getDetailsPO);

// 2. GET /api/mmt/po-bahan/:nomor (Load Data Header + Detail untuk Edit)
router.get('/:nomor', controller.getPOById);



// 3. POST /api/mmt/po-bahan/ (Save/Insert)
router.post('/', controller.savePO);

// 4. PUT /api/mmt/po-bahan/:nomor (Save/Update)
router.put('/:nomor', controller.savePO); // Menggunakan fungsi savePO yang sama untuk update

// 5. DELETE /api/mmt/po-bahan/:nomor (Hapus PO)
router.delete('/:nomor', controller.deletePO);

// 6. PUT /api/mmt/po-bahan/:nomor/toggle-close (Close/Open PO)
router.put('/:nomor/toggle-close', controller.toggleClose);

// 7. GET /api/mmt/po-bahan/load-mkb/:nomor (Lookup MKB)
// Perbaikan pada path dan sintaks pemanggilan
router.get('/load-mkb/:nomor', controller.loadMkbDetail);

router.get('/print/:nomor', controller.getPoDataForPrint);

router.get(
    '/unfulfilled-mb-detail/:mbNomor', 
    controller.getUnfulfilledMbDetail
);

router.get('/po/lookup', controller.lookupPO);

router.get('/po/lookup/:nomor', controller.getPODetail);


// Ekspor menggunakan sintaks CommonJS
module.exports = router;