// backend/services/lapLsBahanBaku.service.js
const pool = require('../config/db.config'); // Pastikan path ini benar
const { format } = require('date-fns');

/**
 * Mengambil Laporan List Stok Bahan Baku
 * (Logika dari loaddata)
 */
const getReport = async (startDate, endDate, gdgKode) => {

  const kodeGudang = gdgKode || 'WH-16';

  const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
  const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

  const ssql = `
    SELECT 
      brg_kode AS kode, 
      brg_nama AS Nama, 
      jb_nama, 
      IF(brg_status='F', 'Fast Moving', IF(brg_status='S', 'Slow Moving', IF(brg_status='N', 'Non Flexy', ''))) AS status,
      IFNULL(brg_panjang, 0) * 1 AS Panjang,
      IFNULL(brg_lebar, 0) * 1 AS Lebar,
      IFNULL(brg_panjang, 0) * (IFNULL(brg_lebar, 0) - 0.1) AS m2,

      IF(a.brg_status='F','Fast Moving',
         IF(a.brg_status='S','Slow Moving',
         IF(a.brg_status='N','Non Flexy',''))) AS status,

      IFNULL(a.brg_panjang,0) AS panjang,
      IFNULL(a.brg_lebar,0) AS lebar,

      (IFNULL(a.brg_panjang,0) * (IFNULL(a.brg_lebar,0) - 0.1)) AS m2_per_roll,

      /* ================= STOK AWAL ================= */
      IFNULL(b.stok_awal,0) AS stok_awal_q,
      IFNULL(b.stok_awal,0) *
      (IFNULL(a.brg_panjang,0) * (IFNULL(a.brg_lebar,0) - 0.1)) AS stok_awal_m,

      /* ================= MASUK ================= */
      IFNULL(c.total_masuk,0) AS terima_q,
      IFNULL(c.total_masuk,0) *
      (IFNULL(a.brg_panjang,0) * (IFNULL(a.brg_lebar,0) - 0.1)) AS terima_m,

      /* ================= KELUAR ================= */
      IFNULL(c.total_keluar,0) AS keluar_q,
      IFNULL(c.total_keluar,0) *
      (IFNULL(a.brg_panjang,0) * (IFNULL(a.brg_lebar,0) - 0.1)) AS keluar_m,

      /* ================= STOK AKHIR ================= */
      IFNULL(d.stok_akhir,0) AS stok_akhir_q,
      IFNULL(d.stok_akhir,0) *
      (IFNULL(a.brg_panjang,0) * (IFNULL(a.brg_lebar,0) - 0.1)) AS stok_akhir_m

    FROM tbarang_mmt a

    /* ===== STOK AWAL ===== */
    LEFT JOIN (
      SELECT mst_brg_kode, 
             SUM(mst_stok_in - mst_stok_out) AS stok_awal
      FROM tmasterstok_mmt
      WHERE mst_tanggal < ?
        AND mst_gdg_kode = ?
      GROUP BY mst_brg_kode
    ) b ON b.mst_brg_kode = a.brg_kode

    /* ===== MUTASI PERIODE ===== */
    LEFT JOIN (
      SELECT 
        mst_brg_kode,
        SUM(mst_stok_in)  AS total_masuk,
        SUM(mst_stok_out) AS total_keluar
      FROM tmasterstok_mmt
      WHERE mst_tanggal BETWEEN ? AND ?
        AND mst_gdg_kode = ?
      GROUP BY mst_brg_kode
    ) c ON c.mst_brg_kode = a.brg_kode

    /* ===== STOK AKHIR ===== */
    LEFT JOIN (
      SELECT mst_brg_kode, 
             SUM(mst_stok_in - mst_stok_out) AS stok_akhir
      FROM tmasterstok_mmt
      WHERE mst_tanggal <= ?
        AND mst_gdg_kode = ?
      GROUP BY mst_brg_kode
    ) d ON d.mst_brg_kode = a.brg_kode

    LEFT JOIN tjenisbarang jb 
      ON jb.jb_kode = a.brg_jenis

    WHERE 
      a.brg_ktg_kode IN ('BU')

    ORDER BY a.brg_nama ASC
  `;

  const params = [
    tglMulai, kodeGudang,             
    tglMulai, tglSelesai, kodeGudang, 
    tglSelesai, kodeGudang            
  ];

  const [rows] = await pool.query(ssql, params);
  return rows;
};




const getTotalRollSekarang = async () => {
  const ssql = `
    SELECT 
      SUM(IFNULL(b.stok_sekarang, 0)) AS total_roll,
      COUNT(a.brg_kode) AS total_jenis_barang
    FROM tbarang_mmt a
    LEFT JOIN (
      SELECT 
        mst_brg_kode, 
        SUM(mst_Stok_in - mst_stok_out) AS stok_sekarang
      FROM tmasterstok_mmt
      WHERE mst_gdg_kode = 'WH-16'
      GROUP BY mst_brg_kode
    ) b ON (b.mst_brg_kode = a.brg_kode)
    WHERE a.brg_gdg_Default = 'WH-16' 
      AND a.brg_ktg_kode = 'BU'
      AND b.stok_sekarang > 0
  `;

  const [rows] = await pool.query(ssql);
  return rows[0]; // Mengembalikan object { total_roll: X, total_jenis_barang: Y }
};

module.exports = {
  getReport,
  getTotalRollSekarang

};