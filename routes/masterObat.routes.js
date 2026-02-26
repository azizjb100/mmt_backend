const express = require("express");
const router = express.Router();
const obatController = require("../controllers/masterObat.controller");
const bahanService = require("../services/masterBahan.service"); // Jika ingin menyatukan route master

// --- Endpoint Khusus Obat ---

// GET /api/master/obat -> Untuk tampilan tabel browse
router.get("/obat", obatController.getAllObat);

// DELETE /api/master/obat/:kode -> Untuk hapus data
router.delete("/obat/:kode", obatController.removeObat);

/**
 * ENDPOINT UNTUK MODAL LOOKUP
 * Sesuai dengan MasterBahanModal.vue yang menggunakan path:
 * /master/bahan/mmt atau /master/bahan/obat
 */
router.get("/", obatController.getLookup);

module.exports = router;