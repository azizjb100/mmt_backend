const express = require("express");
const router = express.Router();
const userCtrl = require("../controllers/user.controller");

// === 1. TARUH ENDPOINT STATIS / SPESIFIK DI ATAS ===
router.get("/", userCtrl.browse);

// === 2. TARUH ENDPOINT DINAMIS BERDASARKAN KODE USER DI BAWAH ===
router.get("/:kode/akses", userCtrl.getAkses);
router.post("/:kode/akses", userCtrl.saveAkses);

module.exports = router;
