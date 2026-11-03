const express = require("express");
const router = express.Router();

const lapMonCetakPaperprintController = require("../controllers/lapMonPaperprint.controller");

router.get(
  "/monitoring",
  lapMonCetakPaperprintController.lapMonCetakPaperprint,
);
router.get(
  "/paperprint",
  lapMonCetakPaperprintController.lapMonCetakPaperprint,
);
router.get(
  "/",
  lapMonCetakPaperprintController.lapMonCetakPaperprint,
);

module.exports = router;
