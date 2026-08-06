const pool = require("../config/db.config");
const { format } = require("date-fns");

/**
 * Helper untuk menangani error database
 */
const throwDbError = (message, error) => {
  console.error(error);
  throw new Error(`${message}: ${error.message}`);
};

/**
 * BROWSE DATA SURAT JALAN (Logika btnRefreshClick di Delphi)
 */
exports.getBrowseSJ = async (
  startDate,
  endDate,
  kdUser,
  zcus = 0,
  zdivisi = 0,
) => {
  try {
    const isAhmad = kdUser === "AHMAD";

    let selectCols = `
            a.sj_nomor AS Nomor, 
            DATE_FORMAT(a.sj_tanggal, '%Y-%m-%d') AS Tanggal, 
            a.Divisi, 
            a.sj_inv_sm AS Invoice, 
        `;

    if (Number(zcus) === 1) {
      selectCols += `
                a.sj_cus_kode AS KdCus, 
                c.cus_nama AS Customer, 
                a.sj_alamat_customer AS Alamat, 
                a.sj_kota_customer AS Kota, 
            `;
    }

    selectCols += `
            a.sj_keterangan AS Keterangan, 
            g.gdg_nama AS Gudang, 
            SUM(d.sjd_jumlah) AS QtyKirim, 
            (IF(a.sj_approve = 2, "Batal", IF(a.sj_approve = 1, "Sudah", ""))) AS Approved, 
            DATE_FORMAT(a.date_create, '%d-%m-%Y %T') AS Created, 
            DATE_FORMAT(a.date_modified, '%d-%m-%Y %T') AS Modified, 
            a.user_produksi AS UsrProduksi, 
            DATE_FORMAT(a.date_produksi, '%d-%m-%Y %T') AS TglUbahProduksi, 
            IFNULL((
                SELECT 
                    IF(pin_acc='' AND pin_dipakai='', 'WAIT', 
                    IF(pin_acc='Y' AND pin_dipakai='', 'ACC', 
                    IF(pin_acc='Y' AND pin_dipakai='Y', '', 
                    IF(pin_acc='N', 'TOLAK', ''))))
                FROM tspk_pin5 
                WHERE pin_trs='SJ' AND pin_nomor=a.sj_nomor 
                ORDER BY pin_urut DESC LIMIT 1
            ), "") AS Ngedit
        `;

    let sqlMaster = `
            SELECT ${selectCols}
            FROM tsj_hdr a
            LEFT JOIN tsj_dtl d ON d.sjd_sj_nomor = a.sj_nomor
            INNER JOIN tgudang g ON g.gdg_kode = a.sj_gdg_kode 
            LEFT JOIN tcustomer c ON c.cus_kode = a.sj_cus_kode 
            LEFT JOIN tdivisi divi ON divi.kode = a.sj_divisi
            WHERE a.sj_status_otomatis = 0 
        `;

    const params = [];

    if (isAhmad) {
      sqlMaster += `
                AND a.sj_nomor IN (
                    SELECT DISTINCT sjd_sj_nomor 
                    FROM tsj_dtl 
                    WHERE sjd_spk_nomor IN (
                        SELECT DISTINCT pojh_spk_nomor FROM tpojasa_hdr_spanduk
                    )
                )
            `;
    }

    sqlMaster += ` AND a.sj_tanggal >= ? AND a.sj_tanggal <= ? `;
    params.push(startDate, endDate);

    if (!isAhmad) {
      if (Number(zdivisi) === 1) sqlMaster += ` AND g.gdg_jadi = 1 `;
      if (Number(zdivisi) === 4) sqlMaster += ` AND g.gdg_jadi = 4 `;
    }

    sqlMaster += ` GROUP BY a.sj_nomor ORDER BY a.sj_tanggal, a.sj_nomor; `;

    const [rows] = await pool.query(sqlMaster, params);
    return rows;
  } catch (error) {
    throwDbError("Gagal mengambil data browse Surat Jalan", error);
  }
};

/**
 * GET DETAIL DATA SURAT JALAN (Sub-grid)
 */
exports.getDetailSJ = async (nomor) => {
  try {
    const sqlDetail = `
            SELECT 
                d.sjd_sj_nomor AS Nomor, 
                d.sjd_spk_nomor AS SPK, 
                s.spk_nama AS Nama, 
                d.sjd_ukuran AS Ukuran, 
                s.spk_panjang AS Panjang, 
                s.spk_lebar AS Lebar, 
                d.sjd_jumlah AS Jumlah, 
                d.SJD_Koli AS Koli, 
                d.sjd_keterangan AS Keterangan, 
                d.sjd_nokirim AS NoKirim, 
                d.sjd_idkirim AS IdKirim
            FROM tsj_hdr h
            INNER JOIN tsj_dtl d ON h.sj_nomor = d.sjd_sj_nomor 
            INNER JOIN tspk s ON s.spk_nomor = d.sjd_spk_nomor 
            WHERE d.sjd_sj_nomor = ? AND h.sj_status_otomatis = 0 
            ORDER BY d.sjd_sj_nomor, d.sjd_nourut;
        `;
    const [rows] = await pool.query(sqlDetail, [nomor]);
    return rows;
  } catch (error) {
    throwDbError("Gagal mengambil detail Surat Jalan", error);
  }
};

/**
 * DELETE DATA SURAT JALAN (Logika cxButton4Click di Delphi)
 */
exports.deleteSJ = async (nomor, invoice, approved) => {
  if (approved === "Sudah") {
    throw new Error(
      "Surat Jalan Sudah di Approve. Silahkan Pending supaya bisa diHapus.",
    );
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(`DELETE FROM tsj_hdr WHERE sj_nomor = ?`, [nomor]);
    await connection.query(`DELETE FROM tsj_hdr WHERE sj_keterangan = ?`, [
      nomor,
    ]);

    if (invoice) {
      await connection.query(`DELETE FROM tinv_hdr WHERE inv_nomor = ?`, [
        invoice,
      ]);
    }

    await connection.commit();
    return true;
  } catch (error) {
    if (connection) await connection.rollback();
    throwDbError("Gagal menghapus Surat Jalan", error);
  } finally {
    if (connection) connection.release();
  }
};

/**
 * CEK URUTAN PENGAJUAN TERAKHIR (Logika PengajuanPerubahanData1Click)
 */
exports.getUrutPengajuanSJ = async (nomor) => {
  try {
    const sql = `
            SELECT * FROM tspk_pin5 
            WHERE pin_trs = 'SJ' AND pin_nomor = ? 
            ORDER BY pin_urut DESC LIMIT 1
        `;
    const [rows] = await pool.query(sql, [nomor]);

    if (rows.length === 0) {
      return { nextUrut: 1, lastAlasan: "" };
    }

    const lastData = rows[0];
    if (!lastData.pin_dipakai || lastData.pin_dipakai === "") {
      return {
        nextUrut: lastData.pin_urut,
        lastAlasan: lastData.pin_alasan || "",
      };
    } else {
      return { nextUrut: lastData.pin_urut + 1, lastAlasan: "" };
    }
  } catch (error) {
    throwDbError("Gagal mengecek urutan pengajuan", error);
  }
};

/**
 * SUBMIT PENGAJUAN PERUBAHAN DATA (Logika btnAjukkanClick di Delphi)
 */
exports.submitPengajuanSJ = async (payload, userLogin) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { nomor, tanggal, keterangan, urut, alasan } = payload;

    if (!alasan || alasan.trim() === "") {
      throw new Error("Alasan harus diisi.");
    }

    const validTanggal = tanggal
      ? format(new Date(tanggal), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd");
    const activeUser = userLogin;

    const sql = `
            INSERT INTO tspk_pin5 (
                pin_trs, pin_nomor, pin_urut, pin_tgl_trs, pin_ket, 
                pin_tgl_minta, pin_user_minta, pin_alasan
            ) VALUES ('SJ', ?, ?, ?, ?, NOW(), ?, ?)
            ON DUPLICATE KEY UPDATE 
                pin_tgl_trs = VALUES(pin_tgl_trs),
                pin_ket = VALUES(pin_ket),
                pin_acc = '',
                pin_tgl_minta = NOW(),
                pin_user_minta = VALUES(pin_user_minta),
                pin_alasan = VALUES(pin_alasan);
        `;

    await connection.query(sql, [
      nomor,
      urut || 1,
      validTanggal,
      keterangan || "",
      activeUser,
      alasan,
    ]);

    await connection.commit();
    return { success: true, message: "Berhasil diajukan. Menunggu ACC" };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
};
