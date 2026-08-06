const express = require("express");
const router = express.Router();

const lapMonCetakPaperprintController = require("../controllers/lapMonPaperprint.controller");

router.get(
  "/monitoring",
  lapMonCetakPaperprintController.lapMonCetakPaperprint,
);

module.exports = router;
