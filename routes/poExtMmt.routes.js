// Di dalam poExtMmt.routes.js

const express = require("express");
const router = express.Router();
const poCtrl = require("../controllers/poExtMmt.controller");

// === 1. TARUH ENDPOINT STATIS / SPESIFIK DI ATAS ===
router.get("/", poCtrl.browse);
router.post("/save", poCtrl.save);
router.post("/submit-pin", poCtrl.submitPin);
router.get("/lookup-bpb", poCtrl.getLookupBpb);

// Endpoint Print yang baru ditambahkan (HARUS DI ATAS /:nomor)
router.get("/print/:nomor", poCtrl.printData);

router.get("/detail/:nomor", poCtrl.getDetailForBpb);
router.get("/sudah-terima/:nomor", poCtrl.getSudahTerima);
router.get("/check-pin/:nomor", poCtrl.checkPin);

// === 2. TARUH ENDPOINT DINAMIS UMUM (/:nomor) DI PALING BAWAH ===
router.get("/:nomor", poCtrl.getById);
router.delete("/:nomor", poCtrl.remove);

module.exports = router;
