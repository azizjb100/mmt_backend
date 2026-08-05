// backend/src/routes/spk.routes.js
const express = require("express");
const router = express.Router();
const spkController = require("../controllers/spk.controller");

// --- Routes untuk SPK ---
router.get("/browse", spkController.getSpkBrowse);
router.get("/lookup", spkController.getSpkLookup);
router.get("/lookup-memo", spkController.getMemoSpkLookup);
router.get("/lookup-sublim", spkController.getSpkForSublimLookup); // <- Tambahkan di sini

router.get("/lookup-jadwal", spkController.lookupSpkForJadwal);
router.get("/lookup-mesin", spkController.getSpkForMesinLookup);

router.get("/detail-size/:nomor", spkController.getSpkDetailSize);
router.get("/print/:nomor", spkController.printSpk);
router.get("/:nomor", spkController.getSpkDetail);

// --- Routes untuk STBJ ---
router.get("/stbj/lookup", spkController.getStbjLookup);
router.get("/stbj/:nomor", spkController.getStbjDetail);

module.exports = router;
