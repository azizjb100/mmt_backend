const express = require("express");
const router = express.Router();
const poController = require("../../controllers/spanduk/penerimaanBahanPenolong.controller");
const verifyToken = require("../../middleware/auth.middleware");

// Endpoint Browse & Lookups
router.get("/browse", poController.getBrowsePO);
router.get("/lookup/sku", poController.lookupSKU);

// Endpoint Detail Data (Dinamis - Letakkan di bawah lookup)
router.get("/:nomor", poController.getPODetail);

// Endpoint Write Data (Membutuhkan validasi token JWT)
router.post("/save", verifyToken, poController.savePO);

module.exports = router;