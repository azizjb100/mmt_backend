const express = require("express");
const router = express.Router();
const bahanController = require("../../controllers/spanduk/masterBahanSpanduk.controller");
const verifyToken = require('../../middleware/auth.middleware');

// List Endpoints
router.get("/", bahanController.getMasterBahan);
router.get("/spanduk", bahanController.getMasterBahan); 

// Lookup Endpoints
router.get("/spanduk/produksi", bahanController.lookupBahanProduksiMMt);
router.get("/lookup/kategori", bahanController.lookupKategori);
router.get("/lookup/gudang", bahanController.lookupGudang);
router.get("/lookup/supplier", bahanController.lookupSupplier);
router.get("/lookup/jenis", bahanController.lookupJenis);
router.get("/lookup/divisi", bahanController.lookupDivisi);

// Detail Endpoints
router.get("/spanduk/:kode", bahanController.getBahanDetailMmt);
router.get("/:kode", bahanController.getBahanDetail);

// Write Endpoints
router.post("/save", verifyToken, bahanController.saveMasterBahan);

module.exports = router;