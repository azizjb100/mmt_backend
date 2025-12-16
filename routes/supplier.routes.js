// backend/src/routes/supplierRoutes.js

const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplier.controller');

// URL dasar: /api/suppliers

// Endpoint 1: Mencari/Memuat Daftar Supplier untuk Modal
// GET /api/suppliers?q=keyword
router.get('/', supplierController.searchSuppliers);

// Endpoint 2: Mengambil Detail Supplier tunggal
// GET /api/suppliers/:kode
router.get('/:kode', supplierController.getSupplierByKode);

module.exports = router;