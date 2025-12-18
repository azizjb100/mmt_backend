// backend/src/routes/permintaanBahan.routes.js

const express = require('express');
const router = express.Router();
const permintaanBahanController = require('../controllers/permintaanBahan.controller');

// READ ALL
router.get('/', permintaanBahanController.getPermintaanBahan); 
router.get('/lookup', permintaanBahanController.lookupPermintaanBahan);

router.get('/detail/:nomor', permintaanBahanController.getPermintaanBahanByNomor);

// DELETE
router.delete('/:nomor', permintaanBahanController.deletePermintaanBahan);

// SAVE (POST/PUT)
router.post('/', permintaanBahanController.savePermintaanBahan); 
router.put('/:nomor', permintaanBahanController.savePermintaanBahan);

// PRINT
router.get('/print/:nomor', permintaanBahanController.getPermintaanBahanForPrint);



module.exports = router;