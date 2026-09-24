const express = require("express");
const router = express.Router();
const controller = require("../controllers/pengajuanKoreksiStok.controller");
const verifyToken = require("../middleware/auth.middleware");

router.get("/", verifyToken, controller.getPengajuan);
router.get("/detail", verifyToken, controller.getDetail);
router.post("/", verifyToken, controller.savePengajuan);
router.delete("/:nomor", verifyToken, controller.deletePengajuan);
router.post("/:nomor/approve", verifyToken, controller.approvePengajuan);
router.post("/:nomor/reject", verifyToken, controller.rejectPengajuan);

module.exports = router;
