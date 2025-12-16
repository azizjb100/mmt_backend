const pool = require('../config/db.config');
const { format } = require('date-fns');

/**
 * Mengambil daftar master LHK Finishing
 * (Logika dari btnRefreshClick -> Self.SQLMaster)
 */
const getAllHeaders = async (startDate, endDate) => {
  const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
  const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

  const sql = `
    SELECT 
      lfh_nomor AS Nomor, 
      DATE_FORMAT(lfh_tanggal, '%d-%m-%Y') AS Tanggal, 
      lfh_gdg_prod AS Gudang, 
      gdg_nama AS Nama_Gudang, 
      lfh_shift AS Shift,
      (SELECT IF(COUNT(*) > COUNT(IF(
            LENGTH(lfd_mataayam_kode) > 0 OR 
            LENGTH(lfd_xbanner_kode) > 0 OR 
            LENGTH(lfd_plastik_kode) > 0 OR 
            LENGTH(lfd_karung_kode) > 0 OR 
            LENGTH(lfd_rollupbanner_kode) > 0, 1, NULL)), 'N', 'Y') 
       FROM tlhk_finishingmmt_dtl 
       WHERE lfd_lfh_nomor = lfh_nomor 
       GROUP BY lfd_lfh_nomor) AS Lengkap
    FROM tlhk_finishingmmt_hdr 
    LEFT JOIN tGUDANG ON (gdg_kode = lfh_gdg_prod)
    WHERE lfh_tanggal BETWEEN ? AND ?
  `;
  
  const [rows] = await pool.query(sql, [tglMulai, tglSelesai]);
  return rows;
};

/**
 * Mengambil detail item dari LHK Finishing terpilih
 * (Logika dari btnRefreshClick -> Self.SQLDetail)
 */
const getDetailsByNomor = async (nomor) => {
  const sql = `
    SELECT 
      lfd_lfh_nomor AS Nomor, 
      lfd_spk_nomor AS Nomor_SPK,
      spk_nama AS Nama_SPK, 
      spk_panjang AS Panjang, 
      spk_lebar AS Lebar, 
      spk_jumlah AS J_Order,
      lfd_j_seaming AS J_Seaming,
      lfd_j_mataayam AS J_MataAyam,
      lfd_j_coly AS J_Coly,
      lfd_j_bs AS J_Bs,
      lfd_j_lebihcetak AS J_LebihCetak,
      lfd_mataayam_qty AS Mata_Ayam,
      lfd_xbanner_qty AS XBanner,
      lfd_plastik_qty AS Plastik,
      lfd_karung_qty AS karung,
      lfd_rollupbanner_qty AS Rullup_Banner,
      lfd_no_urut AS No_Urut
    FROM tlhk_finishingmmt_dtl
    LEFT JOIN (
      SELECT spk_nomor, spk_nama, spk_jumlah, 
             IFNULL(spk_panjang, 0) AS spk_panjang, 
             IFNULL(spk_lebar, 0) AS spk_lebar 
      FROM tspk
      UNION ALL
      SELECT mspk_nomor, mspk_nama, mspk_jumlah, 
             IFNULL(mspk_panjang, 0) AS mspk_panjang, 
             IFNULL(mspk_lebar, 0) AS mspk_lebar 
      FROM tmemospk
    ) x ON (x.spk_nomor = lfd_spk_nomor)
    WHERE lfd_lfh_nomor = ?
    ORDER BY nomor, lfd_no_urut
  `;
  
  const [rows] = await pool.query(sql, [nomor]);
  return rows;
};

/**
 * Menghapus LHK Finishing Header dan Detail
 * (Logika dari cxButton4Click)
 */
const deleteLhk = async (nomor) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM tlhk_finishingmmt_dtl WHERE lfd_lfh_nomor = ?', [nomor]);
    await conn.query('DELETE FROM tlhk_finishingmmt_hdr WHERE lfh_nomor = ?', [nomor]);
    await conn.commit();
    return { success: true, message: 'Berhasil dihapus.' };
  } catch (error) {
    await conn.rollback();
    console.error('Gagal Hapus LHK Finishing:', error);
    throw new Error('Gagal Hapus.');
  } finally {
    conn.release();
  }
};

module.exports = {
  getAllHeaders,
  getDetailsByNomor,
  deleteLhk
};