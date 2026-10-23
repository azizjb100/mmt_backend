// config/db.config.js
//
// Dual-database: MODE REAL & MODE TRIAL
// -------------------------------------
// - Mode REAL   -> database utama (DB_NAME).
// - Mode TRIAL  -> database latihan (DB_NAME_TRIAL), untuk user yang ingin
//                  coba-coba tanpa mengotori data real.
//
// Pemilihan database dilakukan per-request lewat header `X-Data-Mode`
// (lihat middleware/dataMode.middleware.js). Semua service yang sudah
// memakai `pool` dari file ini otomatis ikut, tanpa perlu diubah satu per
// satu, karena AsyncLocalStorage menyimpan mode selama request berjalan.

const mysql = require("mysql2/promise");
const { AsyncLocalStorage } = require("async_hooks");

require("dotenv").config();

const DATA_MODE = Object.freeze({
  REAL: "real",
  TRIAL: "trial",
});

const REAL_DB_NAME = process.env.DB_NAME;
const TRIAL_DB_NAME = String(process.env.DB_NAME_TRIAL || "").trim();

const dbConfig = {
  host: process.env.DB_HOST,
  // PORT penting: saat akses DB lewat SSH tunnel (db-tunnel.ps1), .env
  // memakai DB_PORT=3308 — tanpa baris ini mysql2 memakai default 3306.
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const realPool = mysql.createPool(dbConfig);

// Pool trial hanya dibuat jika DB_NAME_TRIAL diisi. Kalau tidak diisi,
// fitur trial otomatis nonaktif dan UI akan men-disable toggle-nya.
const trialPool = TRIAL_DB_NAME
  ? mysql.createPool({ ...dbConfig, database: TRIAL_DB_NAME })
  : null;

const modeStorage = new AsyncLocalStorage();

const normalizeMode = (mode) =>
  String(mode || "").toLowerCase() === DATA_MODE.TRIAL
    ? DATA_MODE.TRIAL
    : DATA_MODE.REAL;

/** Mode yang sedang aktif pada request saat ini. */
const getDataMode = () => modeStorage.getStore()?.mode || DATA_MODE.REAL;

/** Apakah DB trial dikonfigurasi (belum tentu bisa dihubungi). */
const isTrialConfigured = () => Boolean(trialPool);

const isTrialAvailable = () => Boolean(trialPool);

/**
 * Untuk query yang menulis ke schema lain (mis. `retail.tpacking`):
 * saat mode trial, arahkan ke DB trial supaya data real tidak berubah.
 * Struktur tabel schema tambahan disiapkan oleh `npm run db:trial:init`.
 */
const scopeSchema = (schemaName) =>
  getDataMode() === DATA_MODE.TRIAL && TRIAL_DB_NAME
    ? TRIAL_DB_NAME
    : schemaName;

const activePool = () =>
  getDataMode() === DATA_MODE.TRIAL && trialPool ? trialPool : realPool;

// Proxy pool: semua pemanggil lama (`pool.query`, `pool.execute`,
// `pool.getConnection`) tetap bekerja, tapi diarahkan ke DB sesuai mode.
const pool = {
  get mode() {
    return getDataMode();
  },
  query: (...args) => activePool().query(...args),
  execute: (...args) => activePool().execute(...args),
  getConnection: (...args) => activePool().getConnection(...args),
};

/**
 * Jalankan callback di dalam konteks mode tertentu.
 * Dipakai middleware dan bisa juga dipakai manual (mis. script).
 */
const runWithDataMode = (mode, callback) => {
  const normalized = normalizeMode(mode);
  if (normalized === DATA_MODE.TRIAL && !trialPool) {
    const err = new Error(
      "Mode TRIAL belum dikonfigurasi. Set DB_NAME_TRIAL di .env terlebih dahulu.",
    );
    err.code = "TRIAL_DB_NOT_CONFIGURED";
    throw err;
  }
  return modeStorage.run({ mode: normalized }, callback);
};

// Cache status koneksi trial agar tidak query SELECT 1 di setiap request.
let trialStatus = { ok: false, at: 0, error: "Belum dicek" };

/**
 * Cek apakah database trial benar-benar ada & bisa dipakai.
 * Hasil sukses di-cache 60 detik; kegagalan di-cache 5 detik agar
 * setelah DB trial dibuat user tidak perlu restart backend.
 */
const checkTrialConnection = async (force = false) => {
  if (!trialPool) {
    return {
      ok: false,
      error:
        "DB_NAME_TRIAL belum diset pada .env backend, sehingga mode trial nonaktif.",
    };
  }

  const now = Date.now();
  const ttl = trialStatus.ok ? 60_000 : 5_000;
  if (!force && now - trialStatus.at < ttl) {
    return trialStatus;
  }

  try {
    const connection = await trialPool.getConnection();
    try {
      await connection.query("SELECT 1");
    } finally {
      connection.release();
    }
    trialStatus = { ok: true, at: now, error: null };
  } catch (error) {
    const errorMessage =
      error.code === "ER_BAD_DB_ERROR"
        ? `Database trial "${TRIAL_DB_NAME}" belum dibuat. Jalankan: npm run db:trial:init`
        : error.message;
    trialStatus = { ok: false, at: now, error: errorMessage };
  }

  return trialStatus;
};

module.exports = pool;
module.exports.DATA_MODE = DATA_MODE;
module.exports.REAL_DB_NAME = REAL_DB_NAME;
module.exports.TRIAL_DB_NAME = TRIAL_DB_NAME;
module.exports.realPool = realPool;
module.exports.trialPool = trialPool;
module.exports.runWithDataMode = runWithDataMode;
module.exports.getDataMode = getDataMode;
module.exports.isTrialConfigured = isTrialConfigured;
module.exports.isTrialAvailable = isTrialAvailable;
module.exports.scopeSchema = scopeSchema;
module.exports.checkTrialConnection = checkTrialConnection;
