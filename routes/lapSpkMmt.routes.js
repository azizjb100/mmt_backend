const express = require("express");
const router = express.Router();
const lapSpkController = require("../controllers/lapSpkMmt.controller");

router.get("/", lapSpkController.getReport);

module.exports = router;
