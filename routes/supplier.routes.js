// backend/src/routes/supplierRoutes.js

const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplier.controller');


router.get('/', supplierController.getSuppliers);
router.get('/:kode', supplierController.getSupplierByKode);
router.post('/', supplierController.saveSupplier); // Untuk Tambah Baru
router.put('/', supplierController.saveSupplier);  // Untuk Update
router.delete('/:kode', supplierController.deleteSupplier);


module.exports = router;