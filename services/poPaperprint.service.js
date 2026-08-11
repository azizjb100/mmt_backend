// backend/src/services/poPaperprint.service.js

const pool = require("../config/db.config");
const { format } = require("date-fns");

const throwDbError = (message, error) => {
  console.error(message, error.message);
  throw new Error(message + ": " + error.message);
};

// ========================================================
// GENERATE MAX NOMOR (getmaxnomor - Format: PP.YYYYMM.XXXX)
// ========================================================
const generateMaxNomor = async (tanggal, connection = pool) => {
  const yyyymm = format(new Date(tanggal || new Date()), "yyyyMM");
  const sql = `
        SELECT MAX(RIGHT(pjh_nomor, 4)) AS maxNo 
        FROM tpopaper_hdr 
        WHERE MID(pjh_nomor, 4, 6) = ?
    `;

  try {
    const [rows] = await connection.query(sql, [yyyymm]);
    const nextSeq = rows[0]?.maxNo ? parseInt(rows[0].maxNo, 10) + 1 : 1;
    const formattedSeq = String(nextSeq).padStart(4, "0");
    return `PP.${yyyymm}.${formattedSeq}`;
  } catch (error) {
    throwDbError("Gagal membuat Nomor PO Paperprint otomatis", error);
  }
};

// ========================================================
// READ MASTER DATA (btnRefreshClick - SQLMaster)
// ========================================================
const getPoPaperprintMaster = async (startDate, endDate) => {
  const sqlMaster = `
        SELECT
            pjh_nomor AS Nomor,
            pjh_cab AS Cab,
            DATE_FORMAT(pjh_tanggal, '%Y-%m-%d') AS Tanggal,
            DATE_FORMAT(pjh_dateline, '%Y-%m-%d') AS Dateline,
            pjh_sup_kode AS KodeSup,
            s.Sup_nama AS Supplier,
            s.Sup_alamat AS Alamat,
            pjh_ket AS Keterangan
        FROM tpopaper_hdr pjh
        LEFT JOIN tsupplier s ON s.Sup_kode = pjh.pjh_sup_kode
        WHERE pjh_tanggal BETWEEN ? AND ?
        GROUP BY pjh_nomor
        ORDER BY pjh_tanggal DESC
    `;

  try {
    const [rows] = await pool.query(sqlMaster, [startDate, endDate]);
    return rows;
  } catch (error) {
    throwDbError("Gagal memuat data master PO Paperprint", error);
  }
};

// ========================================================
// READ DETAIL DATA (loadDetails - SQLDetail)
// ========================================================
const getPoPaperprintDetail = async (nomor) => {
  const sqlDetail = `
        SELECT
            pjd_nomor AS Nomor,
            pjd_spk AS Spk,
            pjd_nama AS NamaSpk,
            pjd_ukuran AS Ukuran,
            pjd_bahan AS Bahan,
            pjd_finishing AS Finishing,
            pjd_qty AS Qty,
            pjd_harga AS Harga,
            (pjd_qty * pjd_harga) AS Total,
            pjd_ket AS Keterangan,
            pjd_idgambar AS IdGambar
        FROM tpopaper_dtl
        WHERE pjd_nomor = ? 
        ORDER BY pjd_nomor
    `;

  try {
    const [rows] = await pool.query(sqlDetail, [nomor]);
    return rows;
  } catch (error) {
    throwDbError("Gagal memuat data detail PO Paperprint", error);
  }
};

// ========================================================
// CREATE / SIMPAN DATA (simpandata - Mode Add)
// ========================================================
const createPoPaperprint = async (payload, user = "ADMIN") => {
  const { header, details } = payload;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Generate Nomor Otomatis jika belum diisi dari frontend
    const nomorPO =
      header.nomor && header.nomor.startsWith("PP.")
        ? header.nomor
        : await generateMaxNomor(header.tanggal, connection);

    // 2. Insert Header (tpopaper_hdr)
    const sqlInsertHeader = `
            INSERT INTO tpopaper_hdr
            (pjh_nomor, pjh_tanggal, pjh_dateline, pjh_sup_kode, pjh_ket, pjh_cab, user_create, date_create)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `;

    await connection.query(sqlInsertHeader, [
      nomorPO,
      header.tanggal,
      header.dateline || header.tanggal,
      header.supKode,
      header.keterangan || "",
      header.cab || "P01",
      user,
    ]);

    // 3. Insert Details (tpopaper_dtl)
    if (details && details.length > 0) {
      const detailValues = details.map((item, idx) => [
        nomorPO,
        item.spk || "",
        item.nama || "",
        item.ukuran || "",
        item.bahan || "",
        item.finishing || "",
        parseFloat(item.jumlah || item.qty || 0),
        parseFloat(item.harga || 0),
        item.ket || item.keterangan || "",
        item.idgambar || String(idx + 1).padStart(2, "0"),
      ]);

      const sqlInsertDetail = `
                INSERT INTO tpopaper_dtl
                (pjd_nomor, pjd_spk, pjd_nama, pjd_ukuran, pjd_bahan, pjd_finishing, pjd_qty, pjd_harga, pjd_ket, pjd_idgambar)
                VALUES ?
            `;

      await connection.query(sqlInsertDetail, [detailValues]);
    }

    await connection.commit();
    return { nomor: nomorPO, message: "PO Paperprint berhasil disimpan" };
  } catch (error) {
    if (connection) await connection.rollback();
    throwDbError("Gagal menyimpan PO Paperprint", error);
  } finally {
    if (connection) connection.release();
  }
};

// ========================================================
// UPDATE / EDIT DATA (simpandata - Mode Edit)
// ========================================================
const updatePoPaperprint = async (nomor, payload, user = "ADMIN") => {
  const { header, details } = payload;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Update Header (tpopaper_hdr)
    const sqlUpdateHeader = `
            UPDATE tpopaper_hdr SET
                pjh_tanggal = ?,
                pjh_dateline = ?,
                pjh_sup_kode = ?,
                pjh_ket = ?,
                pjh_cab = ?,
                user_modified = ?,
                date_modified = NOW()
            WHERE pjh_nomor = ?
        `;

    const [headerResult] = await connection.query(sqlUpdateHeader, [
      header.tanggal,
      header.dateline || header.tanggal,
      header.supKode,
      header.keterangan || "",
      header.cab,
      user,
      nomor,
    ]);

    if (headerResult.affectedRows === 0) {
      throw new Error(
        `Transaksi PO Paper dengan nomor ${nomor} tidak ditemukan.`,
      );
    }

    // 2. Hapus detail lama
    const sqlDeleteOldDetails = `DELETE FROM tpopaper_dtl WHERE pjd_nomor = ?`;
    await connection.query(sqlDeleteOldDetails, [nomor]);

    // 3. Insert ulang details baru
    if (details && details.length > 0) {
      const detailValues = details.map((item, idx) => [
        nomor,
        item.spk || "",
        item.nama || "",
        item.ukuran || "",
        item.bahan || "",
        item.finishing || "",
        parseFloat(item.jumlah || item.qty || 0),
        parseFloat(item.harga || 0),
        item.ket || item.keterangan || "",
        item.idgambar || String(idx + 1).padStart(2, "0"),
      ]);

      const sqlInsertDetail = `
                INSERT INTO tpopaper_dtl
                (pjd_nomor, pjd_spk, pjd_nama, pjd_ukuran, pjd_bahan, pjd_finishing, pjd_qty, pjd_harga, pjd_ket, pjd_idgambar)
                VALUES ?
            `;

      await connection.query(sqlInsertDetail, [detailValues]);
    }

    await connection.commit();
    return { nomor, message: "PO Paperprint berhasil diperbarui" };
  } catch (error) {
    if (connection) await connection.rollback();
    throwDbError("Gagal mengedit PO Paperprint", error);
  } finally {
    if (connection) connection.release();
  }
};

// ========================================================
// DELETE (cxButton4Click)
// ========================================================
const deletePoPaperprint = async (nomor) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // FIX: Nama tabel disesuaikan dengan tpopaper_dtl & tpopaper_hdr
    const sqlDeleteDetail = "DELETE FROM tpopaper_dtl WHERE pjd_nomor = ?";
    await connection.query(sqlDeleteDetail, [nomor]);

    const sqlDeleteHeader = "DELETE FROM tpopaper_hdr WHERE pjh_nomor = ?";
    const [headerResult] = await connection.query(sqlDeleteHeader, [nomor]);

    if (headerResult.affectedRows === 0) {
      throw new Error("Nomor transaksi tidak ditemukan atau sudah terhapus.");
    }

    await connection.commit();
    return true;
  } catch (error) {
    if (connection) await connection.rollback();
    throwDbError("Gagal menghapus transaksi PO Paperprint", error);
  } finally {
    if (connection) connection.release();
  }
};

// --- EKSPOR FINAL ---
module.exports = {
  generateMaxNomor,
  getPoPaperprintMaster,
  getPoPaperprintDetail,
  createPoPaperprint,
  updatePoPaperprint,
  deletePoPaperprint,
};
