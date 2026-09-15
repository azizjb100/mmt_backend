const express = require("express");
const router = express.Router();
const bastMapController = require("../controllers/bastMap.controller");

// Sesuaikan middleware auth Anda jika ada (misal: verifyToken, checkPermission, dll)
// const { verifyToken } = require("../middlewares/auth.middleware");

// Route untuk mengambil list browse (GET /api/bast-map)
router.get("/", bastMapController.getBrowseList);

// Route untuk export detail (GET /api/bast-map/export-detail)
// *Catatan: Letakkan sebelum route yang menggunakan parameter `:nomor` agar tidak tertukar*
router.get("/export-detail", bastMapController.getExportDetail);

// Route untuk menghapus BAST (DELETE /api/bast-map/:nomor)
router.delete("/:nomor", bastMapController.deleteBast);

module.exports = router;
