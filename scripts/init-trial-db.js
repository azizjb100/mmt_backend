#!/usr/bin/env node
/**
 * scripts/init-trial-db.js
 *
 * Menyiapkan database TRIAL (DB_NAME_TRIAL) dari database REAL (DB_NAME):
 *   1. Membuat database trial jika belum ada.
 *   2. Meng-clone STRUKTUR semua tabel (tanpa data transaksi).
 *   3. Meng-copy data tabel master/referensi saja, agar form bisa langsung
 *      dipakai untuk coba-coba (supplier, SPK, divisi, dll).
 *   4. Meng-clone VIEW (opsional, dilewati jika gagal).
 *
 * Pemakaian:
 *   npm run db:trial:init                # buat / lengkapi DB trial
 *   npm run db:trial:init -- --reset     # HAPUS lalu buat ulang DB trial
 *   npm run db:trial:init -- --schema-only
 *
 * Daftar tabel master yang di-copy bisa diatur di .env:
 *   TRIAL_SEED_TABLES=tsupplier,tspk,tspk_alokasi,tdivisi,tjenisorder
 */

const mysql = require("mysql2/promise");
require("dotenv").config();

const REAL_DB = String(process.env.DB_NAME || "").trim();
const TRIAL_DB = String(process.env.DB_NAME_TRIAL || "").trim();

const args = process.argv.slice(2);
const RESET = args.includes("--reset");
const SCHEMA_ONLY = args.includes("--schema-only");
const FORCE = args.includes("--force");

const DEFAULT_SEED_TABLES = [
  "tsupplier",
  "tcustomer",
  "tdivisi",
  "tjenisorder",
  "tspk",
  "tspk_alokasi",
  "tspk_size",
  "tbarang",
  "tsatuan",
  "tkategori",
  "tmesin",
  "toperator",
  "trekening",
];

const SEED_TABLES = String(
  process.env.TRIAL_SEED_TABLES || DEFAULT_SEED_TABLES.join(","),
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Schema lain yang tabelnya ditulis oleh aplikasi (mis. retail.tpacking).
// Strukturnya di-clone ke DB trial agar penulisan saat mode trial tidak
// menyentuh data real.
const EXTRA_SCHEMAS = String(process.env.TRIAL_EXTRA_SCHEMAS || "retail")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const quoteId = (name) => `\`${String(name).replace(/`/g, "``")}\``;
const q = (schema, table) => `${quoteId(schema)}.${quoteId(table)}`;

/**
 * Ganti referensi schema real (mis. `retail.` atau `kencanaprint.`) di
 * dalam body trigger/view agar menunjuk ke DB trial, supaya tidak ada
 * penulisan yang bocor ke data produksi.
 */
const retargetSql = (sql) => {
  let output = String(sql);
  for (const schema of [REAL_DB, ...EXTRA_SCHEMAS]) {
    if (!schema) continue;
    const escaped = schema.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\`?${escaped}\`?\\.`, "gi");
    output = output.replace(pattern, `${quoteId(TRIAL_DB)}.`);
  }
  return output;
};

const log = (icon, message) => console.log(`${icon} ${message}`);

async function main() {
  if (!REAL_DB) {
    console.error("❌ DB_NAME belum diset di .env backend.");
    process.exit(1);
  }
  if (!TRIAL_DB) {
    console.error(
      "❌ DB_NAME_TRIAL belum diset di .env backend.\n" +
        "   Contoh: DB_NAME_TRIAL=kencanaprint_trial",
    );
    process.exit(1);
  }
  if (REAL_DB.toLowerCase() === TRIAL_DB.toLowerCase()) {
    console.error(
      "❌ DB_NAME_TRIAL tidak boleh sama dengan DB_NAME (DB real).",
    );
    process.exit(1);
  }

  log("ℹ️", `Database real  : ${REAL_DB}`);
  log("ℹ️", `Database trial : ${TRIAL_DB}`);
  if (SCHEMA_ONLY) log("ℹ️", "Mode: struktur saja (tanpa copy data master)");

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: false,
  });

  try {
    // Data lama banyak memakai default date '0000-00-00'. Longgarkan
    // sql_mode saat DDL agar CREATE TABLE ... LIKE tidak ditolak MySQL 8.
    await connection.query("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");

    // ── 0. Pengaman: jangan menimpa DB yang sudah berisi data transaksi ──
    // DB trial bisa saja menunjuk ke database yang sudah dipakai (mis.
    // kencanaprintnew). Copy master di bawah melakukan TRUNCATE, jadi
    // hentikan dulu kecuali user memang minta (--force / --reset).
    if (!RESET && !SCHEMA_ONLY && !FORCE) {
      const [trialDbExists] = await connection.query(
        `SELECT 1 FROM information_schema.SCHEMATA
          WHERE SCHEMA_NAME = ? LIMIT 1`,
        [TRIAL_DB],
      );

      if (trialDbExists.length > 0) {
        const [poTable] = await connection.query(
          `SELECT 1 FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tpoexternal_hdr' LIMIT 1`,
          [TRIAL_DB],
        );
        let transaksi = 0;
        if (poTable.length > 0) {
          const [rows] = await connection.query(
            `SELECT COUNT(*) AS n FROM ${q(TRIAL_DB, "tpoexternal_hdr")}`,
          );
          transaksi = Number(rows[0].n) || 0;
        }
        const [tblCount] = await connection.query(
          `SELECT COUNT(*) AS n FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = ?`,
          [TRIAL_DB],
        );

        if (transaksi > 0 || Number(tblCount[0].n) > 0) {
          console.error(
            `\n⛔ Database trial "${TRIAL_DB}" sudah ada dan berisi ` +
              `${transaksi} transaksi PO External.\n` +
              "   Menjalankan script ini akan me-TRUNCATE tabel master di DB tersebut.\n\n" +
              "   Pilihan aman:\n" +
              "   • npm run db:trial:init -- --schema-only   (hanya lengkapi struktur)\n" +
              "   • npm run db:trial:init -- --force         (timpa data master)\n" +
              "   • npm run db:trial:init -- --reset         (hapus & buat ulang DB trial)\n",
          );
          process.exit(1);
        }
      }
    }

    if (RESET) {
      log("🗑️", `Menghapus database trial ${TRIAL_DB}...`);
      await connection.query(`DROP DATABASE IF EXISTS ${quoteId(TRIAL_DB)}`);
    }

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${quoteId(TRIAL_DB)} ` +
        `CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`,
    );
    log("✅", `Database ${TRIAL_DB} siap.`);

    // ── 1. Clone struktur tabel ──────────────────────────────────────────
    const [realTables] = await connection.query(
      `SELECT TABLE_NAME AS name
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME`,
      [REAL_DB],
    );

    let created = 0;
    let existed = 0;

    for (const row of realTables) {
      const table = row.name;
      const [check] = await connection.query(
        `SELECT 1 FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
        [TRIAL_DB, table],
      );

      if (check.length > 0) {
        existed += 1;
        continue;
      }

      // CREATE TABLE ... LIKE hanya menyalin struktur + index (tanpa FK),
      // sehingga aman dari urutan pembuatan antar tabel.
      await connection.query(
        `CREATE TABLE ${q(TRIAL_DB, table)} LIKE ${q(REAL_DB, table)}`,
      );
      created += 1;
    }
    log("✅", `Struktur tabel: ${created} dibuat, ${existed} sudah ada.`);

    // ── 1b. Clone struktur tabel dari schema tambahan (mis. retail) ──────
    for (const schema of EXTRA_SCHEMAS) {
      if (!schema || schema.toLowerCase() === TRIAL_DB.toLowerCase()) continue;

      const [schemaExists] = await connection.query(
        `SELECT 1 FROM information_schema.SCHEMATA
          WHERE SCHEMA_NAME = ? LIMIT 1`,
        [schema],
      );
      if (schemaExists.length === 0) {
        log("⚠️", `Schema tambahan dilewati (tidak ada): ${schema}`);
        continue;
      }

      const [tables] = await connection.query(
        `SELECT TABLE_NAME AS name
           FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
          ORDER BY TABLE_NAME`,
        [schema],
      );

      let extraCreated = 0;
      for (const row of tables) {
        const table = row.name;
        const [check] = await connection.query(
          `SELECT 1 FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
          [TRIAL_DB, table],
        );
        if (check.length > 0) continue;

        await connection.query(
          `CREATE TABLE ${q(TRIAL_DB, table)} LIKE ${q(schema, table)}`,
        );
        extraCreated += 1;
      }
      log(
        "✅",
        `Schema ${schema}: ${extraCreated} tabel dibuat di DB trial.`,
      );
    }

    // ── 2. Copy data master ──────────────────────────────────────────────
    if (!SCHEMA_ONLY) {
      log("ℹ️", `Menyalin data master: ${SEED_TABLES.join(", ")}`);

      for (const spec of SEED_TABLES) {
        const [srcSchema, srcTable] = spec.includes(".")
          ? spec.split(".")
          : [REAL_DB, spec];

        try {
          const [srcExists] = await connection.query(
            `SELECT 1 FROM information_schema.TABLES
              WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
            [srcSchema, srcTable],
          );
          if (srcExists.length === 0) {
            log("⚠️", `Dilewati (tidak ada di DB real): ${srcSchema}.${srcTable}`);
            continue;
          }

          const [dstExists] = await connection.query(
            `SELECT 1 FROM information_schema.TABLES
              WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
            [TRIAL_DB, srcTable],
          );
          if (dstExists.length === 0) {
            await connection.query(
              `CREATE TABLE ${q(TRIAL_DB, srcTable)} LIKE ${q(srcSchema, srcTable)}`,
            );
          }

          // Reset dulu agar tabel master tanpa unique key tidak
          // terduplikasi ketika script dijalankan ulang.
          await connection.query(`TRUNCATE TABLE ${q(TRIAL_DB, srcTable)}`);

          const [result] = await connection.query(
            `INSERT IGNORE INTO ${q(TRIAL_DB, srcTable)}
             SELECT * FROM ${q(srcSchema, srcTable)}`,
          );
          log(
            "✅",
            `${srcSchema}.${srcTable}: ${result.affectedRows} baris disalin.`,
          );
        } catch (error) {
          log("⚠️", `Gagal menyalin ${srcSchema}.${srcTable}: ${error.message}`);
        }
      }
    }

    // ── 3. Clone trigger (agar perilaku trial sama dengan real) ──────────
    // Dijalankan SETELAH copy data master supaya trigger tidak ikut
    // mengubah data saat penyalinan.
    await connection.query(`USE ${quoteId(TRIAL_DB)}`);

    const [triggers] = await connection.query(
      `SELECT TRIGGER_NAME AS name
         FROM information_schema.TRIGGERS
        WHERE TRIGGER_SCHEMA = ?
        ORDER BY TRIGGER_NAME`,
      [REAL_DB],
    );

    let triggerOk = 0;
    for (const row of triggers) {
      const trigger = row.name;
      try {
        const [showRows] = await connection.query(
          `SHOW CREATE TRIGGER ${q(REAL_DB, trigger)}`,
        );
        const createSql = showRows[0]["SQL Original Statement"];
        // Buang DEFINER agar tidak bergantung user DB real, lalu arahkan
        // referensi lintas schema (retail.*) ke DB trial.
        const trialSql = retargetSql(
          String(createSql).replace(
            /CREATE\s+DEFINER\s*=\s*`[^`]*`@`[^`]*`\s+/i,
            "CREATE ",
          ),
        );
        await connection.query(`DROP TRIGGER IF EXISTS ${quoteId(trigger)}`);
        await connection.query(trialSql);
        triggerOk += 1;
      } catch (error) {
        log("⚠️", `Trigger dilewati ${trigger}: ${error.message}`);
      }
    }
    log("✅", `Trigger: ${triggerOk}/${triggers.length} berhasil dikloning.`);

    // ── 4. Clone view (best effort) ──────────────────────────────────────
    const [realViews] = await connection.query(
      `SELECT TABLE_NAME AS name
         FROM information_schema.VIEWS
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME`,
      [REAL_DB],
    );

    let viewOk = 0;
    for (const row of realViews) {
      const view = row.name;
      try {
        const [createRows] = await connection.query(
          `SHOW CREATE VIEW ${q(REAL_DB, view)}`,
        );
        const createSql = createRows[0]["Create View"];

        // Ambil bagian "AS select ..." saja, lalu buat ulang view di DB
        // trial. DEFINER dibuang agar tidak bergantung user DB real.
        const match = String(createSql).match(
          /\bVIEW\s+(?:`?[^`\s.]+`?\.)?`?[^`\s]+`?\s+AS\s/i,
        );
        if (!match) throw new Error("format SHOW CREATE VIEW tidak dikenali");

        const definition = String(createSql).slice(
          match.index + match[0].length,
        );
        await connection.query(
          `CREATE OR REPLACE SQL SECURITY INVOKER VIEW ` +
            `${q(TRIAL_DB, view)} AS ${retargetSql(definition)}`,
        );
        viewOk += 1;
      } catch (error) {
        log("⚠️", `View dilewati ${view}: ${error.message}`);
      }
    }
    log("✅", `View: ${viewOk}/${realViews.length} berhasil dikloning.`);

    console.log(
      "\n🎉 Selesai. Buka aplikasi, lalu aktifkan toggle TRIAL di header.\n" +
        "   Data transaksi baru akan masuk ke database trial dan tidak\n" +
        "   memengaruhi data real.",
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("❌ Gagal menyiapkan database trial:", error.message);
  process.exit(1);
});
