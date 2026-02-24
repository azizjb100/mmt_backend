const express = require("express");
const router = express.Router();
const bahanController = require("../controllers/masterBahan.controller");
const verifyToken = require("../middleware/auth.middleware");

// List
router.get("/", bahanController.getMasterBahan);
router.get("/mmt", bahanController.getMasterBahan); // alias existing consumer

// Lookup / static endpoints
router.get("/mmt/produksi", bahanController.lookupBahanProduksiMMt);
router.get("/lookup/kategori", bahanController.lookupKategori);
router.get("/lookup/gudang", bahanController.lookupGudang);
router.get("/lookup/supplier", bahanController.lookupSupplier);
router.get("/lookup/jenis", bahanController.lookupJenis);
router.get("/lookup/divisi", bahanController.lookupDivisi);

// Detail endpoints (dynamic, place at bottom)
router.get("/mmt/:kode", bahanController.getBahanDetailMmt);
router.get("/:kode", bahanController.getBahanDetail);

router.post("/save", verifyToken, bahanController.saveMasterBahan);

module.exports = router;
