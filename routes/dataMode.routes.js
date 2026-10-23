// routes/dataMode.routes.js
//
// Info mode data untuk toggle di header aplikasi.
const express = require("express");
const router = express.Router();

const {
  getDataMode,
  isTrialConfigured,
  checkTrialConnection,
  TRIAL_DB_NAME,
  REAL_DB_NAME,
} = require("../config/db.config");

router.get("/", async (req, res) => {
  // Endpoint ini selalu dijalankan pada konteks mode yang diminta
  // middleware. Status koneksi trial dicek langsung ke pool trial.
  const trialStatus = await checkTrialConnection();

  res.json({
    success: true,
    data: {
      mode: getDataMode(),
      realDatabase: REAL_DB_NAME,
      trialConfigured: isTrialConfigured(),
      trialAvailable: trialStatus.ok,
      trialDatabase: TRIAL_DB_NAME || null,
      trialError: trialStatus.error || null,
    },
  });
});

module.exports = router;
