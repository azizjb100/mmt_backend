const express = require("express");
const router = express.Router();
const bahanController = require("../controllers/masterBahan.controller");
const verifyToken = require("../middleware/auth.middleware");

// 1. Endpoint untuk List (Gunakan "/" tanpa parameter di paling atas)
router.get("/", bahanController.getMasterBahan);

// 2. Endpoint Lookup/Spesifik (Statis)
router.get("/mmt/produksi", bahanController.lookupBahanProduksiMMt);
router.get("/lookup/kategori", bahanController.lookupKategori);
router.get("/lookup/gudang", bahanController.lookupGudang);
router.get("/lookup/supplier", bahanController.lookupSupplier);
router.get("/lookup/jenis", bahanController.lookupJenis);
router.get("/lookup/divisi", bahanController.lookupDivisi);

// 3. Endpoint dengan Parameter Dinamis (Paling Bawah)
router.get("/mmt/:kode", bahanController.getBahanDetailMmt); 
router.get("/detail/:kode", bahanController.getBahanDetail); // Tambahkan prefix 'detail' agar aman
// ATAU jika tetap ingin /:kode, letakkan di paling akhir:
// router.get("/:kode", bahanController.getBahanDetail);

router.post("/save", verifyToken, bahanController.saveMasterBahan);

module.exports = router;
