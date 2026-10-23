#!/usr/bin/env node
/**
 * scripts/sync-trial-schema.js
 *
 * Menyelaraskan STRUKTUR KOLOM database TRIAL dengan database REAL.
 * Hanya MENAMBAH kolom yang belum ada di trial; tidak pernah menghapus
 * atau mengubah kolom/data yang sudah ada.
 *
 * Berguna ketika DB trial sudah berisi data (mis. kencanaprintnew) tetapi
 * skemanya tertinggal dari DB real sehingga muncul error seperti:
 *   "Unknown column 'poe_tipe_hitung' in 'field list'"
 *
 * Pemakaian:
 *   npm run db:trial:sync             # dry-run, hanya menampilkan rencana
 *   npm run db:trial:sync -- --apply  # eksekusi ALTER TABLE
 */

const mysql = require("mysql2/promise");
require("dotenv").config();

const REAL_DB = String(process.env.DB_NAME || "").trim();
const TRIAL_DB = String(process.env.DB_NAME_TRIAL || "").trim();
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const WITH_TYPES = args.includes("--with-types");
const CREATE_TABLES = args.includes("--create-tables");
const FIX_TRIGGERS = args.includes("--fix-triggers");

// Tabel schema lain yang ditulis oleh aplikasi/trigger. Saat mode trial,
// scopeSchema() mengarahkan penulisan ke DB trial, jadi tabel ini harus
// ada di DB trial (struktur saja).
const CROSS_SCHEMA_TABLES = String(
  process.env.TRIAL_CROSS_SCHEMA_TABLES ||
    "retail.tpacking,retail.tdc_stbj,retail.tbarangdc_dtl",
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Ganti referensi schema real (mis. `retail.`) menjadi DB trial di dalam
 * body trigger agar tidak menulis ke data produksi.
 */
const retargetSql = (sql) => {
  let output = String(sql);
  for (const schema of [REAL_DB, "retail"]) {
    if (!schema) continue;
    const escaped = schema.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    output = output.replace(
      new RegExp(`\`?${escaped}\`?\\.`, "gi"),
      `${quoteId(TRIAL_DB)}.`,
    );
  }
  return output;
};

const quoteId = (name) => `\`${String(name).replace(/`/g, "``")}\``;

/** Ambil definisi kolom persis dari SHOW CREATE TABLE DB real. */
const extractColumnDefinitions = (createSql) => {
  const map = new Map();
  for (const rawLine of String(createSql).split(/\r?\n/)) {
    const match = rawLine.match(/^\s+`([^`]+)`\s/);
    if (!match) continue;
    map.set(match[1], rawLine.trim().replace(/,$/, ""));
  }
  return map;
};

const main = async () => {
  if (!REAL_DB || !TRIAL_DB) {
    console.error("❌ DB_NAME / DB_NAME_TRIAL belum diset di .env");
    process.exit(1);
  }
  if (REAL_DB.toLowerCase() === TRIAL_DB.toLowerCase()) {
    console.error("❌ DB_NAME_TRIAL tidak boleh sama dengan DB_NAME");
    process.exit(1);
  }

  console.log(`REAL : ${REAL_DB}`);
  console.log(`TRIAL: ${TRIAL_DB}`);
  console.log(`Mode : ${APPLY ? "APPLY (menulis ALTER)" : "DRY-RUN"}\n`);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    await connection.query("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");

    const [tables] = await connection.query(
      `SELECT a.TABLE_NAME AS name
         FROM information_schema.TABLES a
         JOIN information_schema.TABLES b
           ON b.TABLE_SCHEMA = ?
          AND b.TABLE_NAME = a.TABLE_NAME
          AND b.TABLE_TYPE = 'BASE TABLE'
        WHERE a.TABLE_SCHEMA = ?
          AND a.TABLE_TYPE = 'BASE TABLE'
        ORDER BY a.TABLE_NAME`,
      [TRIAL_DB, REAL_DB],
    );

    // ── Opsional: buat tabel yang belum ada di DB trial ─────────────────
    if (CREATE_TABLES) {
      const [realAll] = await connection.query(
        `SELECT TABLE_NAME AS n FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
        [REAL_DB],
      );
      const [trialAll] = await connection.query(
        `SELECT TABLE_NAME AS n FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ?`,
        [TRIAL_DB],
      );
      const trialNames = new Set(trialAll.map((r) => r.n));

      let created = 0;
      for (const { n } of realAll) {
        if (trialNames.has(n)) continue;
        if (APPLY) {
          await connection.query(
            `CREATE TABLE \`${TRIAL_DB}\`.\`${n}\` LIKE \`${REAL_DB}\`.\`${n}\``,
          );
          console.log(`✅ tabel ${n} dibuat`);
          created += 1;
        } else {
          console.log(`• tabel ${n} belum ada`);
        }
      }

      for (const spec of CROSS_SCHEMA_TABLES) {
        const [schema, table] = spec.split(".");
        if (!schema || !table) continue;

        const [src] = await connection.query(
          `SELECT 1 FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
          [schema, table],
        );
        const [dst] = await connection.query(
          `SELECT 1 FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
          [TRIAL_DB, table],
        );
        if (src.length === 0 || dst.length > 0) continue;

        if (APPLY) {
          await connection.query(
            `CREATE TABLE \`${TRIAL_DB}\`.\`${table}\` LIKE \`${schema}\`.\`${table}\``,
          );
          console.log(`✅ tabel ${schema}.${table} dibuat di trial`);
          created += 1;
        } else {
          console.log(`• tabel ${schema}.${table} belum ada di trial`);
        }
      }

      console.log(`Total tabel dibuat: ${created}\n`);
    }

    // ── Opsional: arahkan trigger trial yang menulis ke schema real ─────
    if (FIX_TRIGGERS) {
      await connection.query(`USE ${quoteId(TRIAL_DB)}`);
      const [triggerRows] = await connection.query(
        `SELECT TRIGGER_NAME AS n FROM information_schema.TRIGGERS
          WHERE TRIGGER_SCHEMA = ?`,
        [TRIAL_DB],
      );

      let fixed = 0;
      for (const { n: trigger } of triggerRows) {
        const [rows] = await connection.query(
          `SHOW CREATE TRIGGER \`${TRIAL_DB}\`.\`${trigger}\``,
        );
        const original = rows[0]["SQL Original Statement"];
        if (!/(?:`?retail`?\.|`?kencanaprint`?\.)/i.test(original)) continue;

        const newSql = retargetSql(
          String(original).replace(
            /CREATE\s+DEFINER\s*=\s*`[^`]*`@`[^`]*`\s+/i,
            "CREATE ",
          ),
        );

        if (!APPLY) {
          console.log(`• trigger ${trigger} perlu diarahkan ke trial`);
          continue;
        }

        await connection.query(`DROP TRIGGER IF EXISTS ${quoteId(trigger)}`);
        await connection.query(newSql);
        console.log(`✅ trigger ${trigger} diarahkan ke trial`);
        fixed += 1;
      }
      console.log(`Total trigger diperbaiki: ${fixed}\n`);
    }

    const [realColumns] = await connection.query(
      `SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, DATA_TYPE,
              CHARACTER_MAXIMUM_LENGTH AS char_length
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [REAL_DB],
    );

    const [trialColumns] = await connection.query(
      `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE,
              CHARACTER_MAXIMUM_LENGTH AS char_length
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ?`,
      [TRIAL_DB],
    );

    const trialMap = new Map(
      trialColumns.map((c) => [`${c.TABLE_NAME}.${c.COLUMN_NAME}`, c]),
    );
    const trialSet = new Set(trialMap.keys());

    const columnsByTable = new Map();
    for (const col of realColumns) {
      if (!columnsByTable.has(col.TABLE_NAME)) {
        columnsByTable.set(col.TABLE_NAME, []);
      }
      columnsByTable.get(col.TABLE_NAME).push(col);
    }

    let totalMissing = 0;
    let totalApplied = 0;
    const statements = [];

    for (const { name: table } of tables) {
      const realCols = columnsByTable.get(table) || [];
      const missing = realCols.filter(
        (c) => !trialSet.has(`${table}.${c.COLUMN_NAME}`),
      );
      if (missing.length === 0) continue;

      totalMissing += missing.length;

      const [showRows] = await connection.query(
        `SHOW CREATE TABLE \`${REAL_DB}\`.\`${table}\``,
      );
      const definitions = extractColumnDefinitions(
        showRows[0]["Create Table"],
      );

      for (const col of missing) {
        const definition = definitions.get(col.COLUMN_NAME);
        if (!definition) {
          console.log(`⚠️  ${table}.${col.COLUMN_NAME}: definisi tidak ditemukan`);
          continue;
        }

        // Posisikan setelah kolom sebelumnya yang sudah ada di trial.
        let position = " FIRST";
        const prev = realCols
          .filter((c) => c.ORDINAL_POSITION < col.ORDINAL_POSITION)
          .reverse()
          .find((c) => trialSet.has(`${table}.${c.COLUMN_NAME}`));
        if (prev) position = ` AFTER ${quoteId(prev.COLUMN_NAME)}`;

        const sql =
          `ALTER TABLE \`${TRIAL_DB}\`.\`${table}\` ` +
          `ADD COLUMN ${definition}${position}` +
          // Kolom AUTO_INCREMENT wajib menjadi key.
          (/AUTO_INCREMENT/i.test(definition)
            ? `, ADD UNIQUE KEY ${quoteId(
                `uq_${table}_${col.COLUMN_NAME}`.slice(0, 60),
              )} (${quoteId(col.COLUMN_NAME)})`
            : "");
        statements.push({ table, column: col.COLUMN_NAME, sql });

        if (APPLY) {
          try {
            await connection.query(sql);
            totalApplied += 1;
            console.log(`✅ ${table}.${col.COLUMN_NAME} ditambahkan`);
          } catch (error) {
            console.log(`❌ ${table}.${col.COLUMN_NAME}: ${error.message}`);
          }
        } else {
          console.log(`• ${table}.${col.COLUMN_NAME}`);
        }
      }
    }

    // ── Selaraskan tipe yang aman (memperlebar varchar / date->datetime) ──
    let totalTypeChanges = 0;
    let totalTypeApplied = 0;

    if (WITH_TYPES) {
      console.log("");
      for (const { name: table } of tables) {
        const realCols = columnsByTable.get(table) || [];
        const typeChanges = [];

        for (const col of realCols) {
          const trialCol = trialMap.get(`${table}.${col.COLUMN_NAME}`);
          if (!trialCol) continue;

          const realLen = Number(col.char_length) || 0;
          const trialLen = Number(trialCol.char_length) || 0;
          const isWiderText =
            col.DATA_TYPE === trialCol.DATA_TYPE &&
            realLen > trialLen &&
            trialLen > 0;
          const isDateToDateTime =
            trialCol.DATA_TYPE === "date" && col.DATA_TYPE === "datetime";

          if (isWiderText || isDateToDateTime) typeChanges.push(col);
        }

        if (typeChanges.length === 0) continue;

        const [showRows] = await connection.query(
          `SHOW CREATE TABLE \`${REAL_DB}\`.\`${table}\``,
        );
        const definitions = extractColumnDefinitions(
          showRows[0]["Create Table"],
        );

        for (const col of typeChanges) {
          const definition = definitions.get(col.COLUMN_NAME);
          if (!definition) continue;

          totalTypeChanges += 1;
          const sql =
            `ALTER TABLE \`${TRIAL_DB}\`.\`${table}\` ` +
            `MODIFY COLUMN ${definition}`;

          if (APPLY) {
            try {
              await connection.query(sql);
              totalTypeApplied += 1;
              console.log(`✅ tipe ${table}.${col.COLUMN_NAME} diselaraskan`);
            } catch (error) {
              console.log(
                `❌ tipe ${table}.${col.COLUMN_NAME}: ${error.message}`,
              );
            }
          } else {
            console.log(`• tipe ${table}.${col.COLUMN_NAME}`);
          }
        }
      }
    }

    console.log(
      `\nTotal kolom kurang: ${totalMissing} pada ${
        new Set(statements.map((s) => s.table)).size
      } tabel.`,
    );
    if (WITH_TYPES) {
      console.log(`Total penyesuaian tipe: ${totalTypeChanges} kolom.`);
    }

    if (!APPLY) {
      if (statements.length > 0 || totalTypeChanges > 0) {
        console.log(
          "\nJalankan ulang dengan --apply untuk menerapkan perubahan:\n" +
            "  npm run db:trial:sync -- --apply\n" +
            "  npm run db:trial:sync -- --apply --with-types",
        );
      }
    } else {
      console.log(`Berhasil ditambahkan: ${totalApplied} kolom.`);
      if (WITH_TYPES) {
        console.log(`Berhasil diselaraskan tipenya: ${totalTypeApplied} kolom.`);
      }
    }
  } finally {
    await connection.end();
  }
};

main().catch((error) => {
  console.error("❌ Gagal sync schema:", error.message);
  process.exit(1);
});
