// backend/src/services/jadwalKirim.service.js
const pool = require('../config/db.config');

/**
 * Mengambil data Jadwal Kirim (Master) 
 * Sesuai logika SQLMaster di ufrmBrowseJadwalKirim2
 */
const getJadwalKirimData = async (startDate, endDate, gudang) => {
  let params = [startDate, endDate];
  
  let sql = `
    SELECT 
      a.Nomor_Kirim AS Nomor, 
      a.Gudang, 
      gdg.gdg_nama AS Nama_Gudang, 
      a.Tanggal,
      a.spk_nomor AS No_SPK, 
      b.spk_nama AS Nama_Spk, 
      b.spk_ukuran AS Ukuran,
      b.spk_kain AS Kain,
      IFNULL(a.Jumlah, 0) AS Jumlah, 
      IFNULL(a.Koli, 0) AS Koli, 
      IFNULL(a.Realisasi, 0) AS Realisasi,
      IFNULL(a.koli_Realisasi, 0) AS Koli_Realisasi, 
      (IFNULL(a.Realisasi, 0) - IFNULL(a.Jumlah, 0)) AS Selisih_Jumlah,
      (IFNULL(a.koli_Realisasi, 0) - IFNULL(a.koli, 0)) AS Selisih_Koli,
      a.usr_create 
    FROM tjadwalkirim a 
    LEFT JOIN (
      SELECT spk_nomor, spk_nama, spk_ukuran, spk_kain FROM tspk WHERE spk_aktif = 'Y'
      UNION ALL 
      SELECT mspk_nomor, mspk_nama, mspk_ukuran, mspk_kain FROM tmemospk
    ) b ON b.spk_nomor = a.spk_nomor
    LEFT JOIN tgudang gdg ON gdg.gdg_kode = a.gudang 
    WHERE a.tanggal >= ? AND a.tanggal <= ?
  `;

  // Filter Gudang (edtgudang.Text)
  if (gudang) {
    sql += ` AND a.gudang LIKE ?`;
    params.push(`%${gudang}%`);
  }

  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.error("Database Master Error:", error);
    throw new Error("Gagal mengambil data Jadwal Kirim");
  }
};

/**
 * Menghapus data Jadwal Kirim
 * Sesuai logika cxButton4Click di ufrmBrowseJadwalKirim2
 */
const deleteJadwalKirim = async (params) => {
  // Di versi JadwalKirim2, penghapusan cukup menggunakan nomor_kirim
  const { nomor } = params; 
  
  const sql = `DELETE FROM tjadwalkirim WHERE nomor_kirim = ?`;

  try {
    const [result] = await pool.query(sql, [nomor]);
    return result.affectedRows > 0;
  } catch (error) {
    console.error("Delete Error:", error);
    throw new Error("Gagal menghapus data jadwal kirim.");
  }
};

// Properti module.exports tetap sama agar tidak merusak pemanggilan di Controller
module.exports = {
  getJadwalKirimData,
  deleteJadwalKirim
};