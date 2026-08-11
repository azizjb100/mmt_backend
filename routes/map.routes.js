const express = require("express");
const router = express.Router();
const controller = require("../controllers/map.controller"); // Sesuaikan nama file controller jika 'mapController'
const verifyToken = require("../middleware/auth.middleware");

// 1. ROUTE UTAMA & BROWSE
router.get("/", verifyToken, controller.getBrowseList);

// 2. ROUTE SPESIFIK / DESIGN (Ditaruh sebelum route yang pakai parameter :nomor)
router.get("/design/list", verifyToken, controller.getDesignList);
router.put("/design/status", verifyToken, controller.updateDesignStatus);

// 3. ROUTE DINAMIS PARAMETER & ACTION (HARUS DI PALING BAWAH)
router.put("/:nomor/close", verifyToken, controller.toggleClose);
router.put("/:nomor/approve", verifyToken, controller.approveCmo);
router.post("/:nomor/pin5", verifyToken, controller.requestPin5);
router.delete("/:nomor", verifyToken, controller.deleteMap);

module.exports = router;
