// backend/src/services/koreksiStokService.js

const pool = require('../config/db.config'); // Asumsi modul koneksi database Anda
const { format } = require('date-fns');

// Helper untuk penanganan error database
const throwDbError = (message, error) => {
  console.error(message, error.message);
  throw new Error(message + ': ' + error.message);
};

// ========================================================
// READ MASTER DATA (btnRefreshClick - SQLMaster)
// ========================================================
exports.getKoreksiStokMaster = async (startDate, endDate) => {
  const sqlMaster = `
    SELECT
      korh_nomor AS Nomor,
      DATE_FORMAT(korh_tanggal, '%d-%M-%Y') AS Tanggal,
      b.gdg_nama AS Gudang,
      korh_type AS Tipe,
      c.nama AS Nama,
      korh_notes AS Keterangan
    FROM tkor_hdr_mmt a
    LEFT JOIN tgudang b ON b.gdg_kode = a.korh_gdg_kode
    LEFT JOIN tkor_type c ON c.kode = a.korh_type
    WHERE korh_tanggal BETWEEN ? AND ?
     AND IFNULL(korh_typekor, 0) = 0
     AND b.gdg_kode LIKE '%WH-%'
    GROUP BY korh_nomor, korh_tanggal, korh_notes, b.gdg_nama, korh_type, c.nama
    ORDER BY korh_tanggal DESC
  `;

  try {
    // Format tanggal untuk SQL WHERE clause (YYYY-MM-DD)
    const params = [
      format(new Date(startDate), 'yyyy-MM-dd'),
      format(new Date(endDate), 'yyyy-MM-dd')
    ];
    const [rows] = await pool.query(sqlMaster, params);
    return rows;
  } catch (error) {
    throwDbError('Gagal memuat data master Koreksi Stok', error);
  }
};

// ========================================================
// READ DETAIL DATA (loadDetails - SQLDetail)
// ========================================================
exports.getKoreksiStokDetail = async (nomor) => {
  const sqlDetail = `
    SELECT
      korh_nomor AS Nomor,
      kord_brg_kode AS Kode,
      brg_nama AS Nama,
      brg_panjang * 1 AS Panjang,
      brg_lebar * 1 AS Lebar,
      kord_satuan AS Satuan,
      kord_stok AS Stock,
      kord_fisik AS Fisik,
      kord_qty AS Koreksi
    FROM tkor_dtl_mmt
    INNER JOIN tkor_hdr_mmt ON korh_nomor = kord_korh_nomor
    INNER JOIN tbarang_mmt ON kord_brg_kode = brg_kode
    WHERE korh_nomor = ? 
    ORDER BY kord_nourut;
  `;

  try {
    const [rows] = await pool.query(sqlDetail, [nomor]);
    return rows;
  } catch (error) {
    throwDbError('Gagal memuat data detail Koreksi Stok', error);
  }
};


// ========================================================
// DELETE (cxButton4Click)
// ========================================================
exports.deleteKoreksiStok = async (nomor, user) => {
  const connection = await pool.getConnection();
  // Asumsi cekdelete sudah dilakukan di frontend
  try {
    await connection.beginTransaction();

    // 1. Hapus Detail (tkor_dtl_mmt)
    const sqlDeleteDetail = 'DELETE FROM tkor_dtl_mmt WHERE kord_korh_nomor = ?';
    await connection.query(sqlDeleteDetail, [nomor]);

    // 2. Hapus Header (tkor_hdr_mmt)
    const sqlDeleteHeader = 'DELETE FROM tkor_hdr_mmt WHERE korh_nomor = ?';
    const [headerResult] = await connection.query(sqlDeleteHeader, [nomor]);
    
    if (headerResult.affectedRows === 0) {
      throw new Error("Nomor transaksi tidak ditemukan atau sudah terhapus.");
    }
    
    await connection.commit();
    return true;
    
  } catch (error) {
    await connection.rollback();
    throwDbError('Gagal menghapus transaksi Koreksi Stok', error);
  } finally {
    connection.release();
  }
};

// ========================================================
// GENERATE MAX KODE (getmaxkode)
// ========================================================
exports.generateMaxKode = async (tanggal) => {
  const NOMERATOR = 'KOR'; // Contoh nomerator
  const yyMm = format(new Date(tanggal), 'yyMM');
  
  // Mengambil max nomor (asumsi menggunakan kode 3 digit setelah tanggal)
  const sql = `
    SELECT MAX(RIGHT(korh_nomor, 3)) AS max_num 
    FROM tkor_hdr_mmt 
    WHERE korh_nomor LIKE ?
  `;
  const prefix = `${NOMERATOR}.${yyMm}.%`;
  const [rows] = await pool.query(sql, [prefix]);
  
  const maxNum = rows[0].max_num ? parseInt(rows[0].max_num) : 0;
  const newSequence = maxNum + 1; 
  
  return `${NOMERATOR}.${yyMm}.${String(newSequence).padStart(3, '0')}`;
};