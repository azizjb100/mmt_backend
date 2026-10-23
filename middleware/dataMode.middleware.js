// middleware/dataMode.middleware.js
//
// Menentukan database mana yang dipakai untuk request ini:
//   header  X-Data-Mode: real | trial
//   query   ?mode=trial (alternatif, mis. untuk testing/print link)
//
// Default: real. Endpoint autentikasi SELALU memakai DB real agar login
// tidak ikut terganggu ketika user sedang berada di mode trial.

const {
  DATA_MODE,
  isTrialConfigured,
  checkTrialConnection,
  runWithDataMode,
} = require("../config/db.config");

const normalizeMode = (value) =>
  String(value || "").toLowerCase() === DATA_MODE.TRIAL
    ? DATA_MODE.TRIAL
    : DATA_MODE.REAL;

const dataModeMiddleware = async (req, res, next) => {
  const originalUrl = req.originalUrl || req.url || "";
  const isAuthRoute = originalUrl.startsWith("/api/auth");
  const isModeInfoRoute = originalUrl.startsWith("/api/system/data-mode");

  const requestedMode = isAuthRoute
    ? DATA_MODE.REAL
    : normalizeMode(req.headers["x-data-mode"] || req.query.mode);

  // Endpoint info mode harus selalu bisa diakses walau DB trial sedang
  // bermasalah, supaya UI bisa menampilkan error & kembali ke mode real.
  if (requestedMode === DATA_MODE.TRIAL && !isModeInfoRoute) {
    if (!isTrialConfigured()) {
      return res.status(503).json({
        success: false,
        message:
          "Mode TRIAL belum tersedia. Hubungi admin untuk mengatur DB_NAME_TRIAL di server.",
      });
    }

    const status = await checkTrialConnection();
    if (!status.ok) {
      return res.status(503).json({
        success: false,
        message: status.error || "Database trial tidak dapat dihubungi.",
      });
    }
  }

  // Info mode: jika trial belum dikonfigurasi, tetap jalankan di konteks
  // real supaya endpoint bisa melaporkan status tanpa error.
  const effectiveMode =
    requestedMode === DATA_MODE.TRIAL &&
    isModeInfoRoute &&
    !isTrialConfigured()
      ? DATA_MODE.REAL
      : requestedMode;

  // Konteks AsyncLocalStorage diteruskan ke seluruh handler async di
  // bawahnya, sehingga `pool` otomatis menunjuk DB yang sesuai.
  runWithDataMode(effectiveMode, () => next());
};

module.exports = dataModeMiddleware;
