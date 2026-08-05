const express = require("express");
const router = express.Router();
const controller = require("../controllers/salesOrder.controller");

// ==========================================
// 1. ROUTE STATIS / SPESIFIK (Wajib Di Atas)
// ==========================================

router.get("/pending-design", controller.getPendingDesigns);
router.put("/update-design", controller.updateDesignStatus);

router.get("/pembatalan-detail", controller.getPembatalanDetail);
router.post("/pembatalan-ajukan", controller.ajukanPembatalan);

router.get("/ganti-qty-kain-status", controller.getGantiQtyKainStatus);
router.post("/ganti-qty-kain-ajukan", controller.ajukanGantiQtyKain);

// ==========================================
// 2. ROUTE UTAMA & DENGAN PARAMETER (:nomor)
// ==========================================

router.get("/", controller.getBrowse);

// Routes dengan parameter (:nomor) ditaruh di bawah
router.delete("/:nomor", controller.deleteOrder);
router.put("/:nomor/toggle-close", controller.toggleClose);
router.post("/:nomor/request-pin", controller.requestPin);
router.get("/:nomor/sizes", controller.getSizes);

// Rute APPROVAL CMO
router.put("/:nomor/approve", controller.approveCmo);

module.exports = router;
