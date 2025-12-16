// backend/services/lapLsBahanBaku.service.js
const pool = require('../config/db.config'); // Pastikan path ini benar
const { format } = require('date-fns');

/**
 * Mengambil Laporan List Stok Bahan Baku
 * (Logika dari loaddata)
 */
const getReport = async (startDate, endDate) => {
  // Format tanggal agar aman untuk SQL (YYYY-MM-DD)
  const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
  const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

  const ssql = `
    SELECT 
      brg_kode AS kode, 
      brg_nama AS Nama, 
      brg_jenis, 
      jb_nama, 
      brg_gramasi AS Spesifikasi,
      IF(brg_status='F', 'Fast Moving', IF(brg_status='S', 'Slow Moving', IF(brg_status='N', 'Non Flexy', ''))) AS status,
      brg_satuan AS Satuan,
      IFNULL(brg_panjang, 0) * 1 AS Panjang,
      IFNULL(brg_lebar, 0) * 1 AS Lebar,
      IFNULL(brg_panjang, 0) * (IFNULL(brg_lebar, 0) - 0.1) AS m2,
      
      IFNULL(stok_awal, 0) AS stok_awal_q,
      IFNULL(stok_awal, 0) * (IFNULL(brg_panjang, 0) * (IFNULL(brg_lebar, 0) - 0.1)) AS stok_awal_m,
      
      IFNULL(rec, 0) + IF(IFNULL(mut, 0) > 0, mut, 0) + IF(IFNULL(kor, 0) > 0, kor, 0) AS terima_q,
      (IFNULL(rec, 0) + IF(IFNULL(mut, 0) > 0, mut, 0) + IF(IFNULL(kor, 0) > 0, kor, 0)) * (IFNULL(brg_panjang, 0) * (IFNULL(brg_lebar, 0) - 0.1)) AS terima_m,
      
      IFNULL(prod, 0) + IFNULL(retsup, 0) + IF(IFNULL(mut, 0) < 0, ABS(mut), 0) + IF(IFNULL(kor, 0) < 0, ABS(kor), 0) AS keluar_q,
      (IFNULL(prod, 0) + IFNULL(retsup, 0) + IF(IFNULL(mut, 0) < 0, ABS(mut), 0) + IF(IFNULL(kor, 0) < 0, ABS(kor), 0)) * (IFNULL(brg_panjang, 0) * (IFNULL(brg_lebar, 0) - 0.1)) AS keluar_m,
      
      IFNULL(retprod, 0) AS retur_q,
      (IFNULL(retprod, 0)) * (IFNULL(brg_panjang, 0) * (IFNULL(brg_lebar, 0) - 0.1)) AS retur_m,
      
      IFNULL(stok_akhir, 0) AS stok_akhir_q,
      IFNULL(stok_akhir, 0) * (IFNULL(brg_panjang, 0) * (IFNULL(brg_lebar, 0) - 0.1)) AS stok_akhir_m
      
    FROM tbarang_mmt a
    
    LEFT JOIN (
      SELECT mst_brg_kode, SUM(mst_Stok_in - mst_stok_out) AS stok_awal
      FROM tmasterstok_mmt
      WHERE mst_tanggal < ? AND mst_gdg_kode = 'WH-16'
      GROUP BY mst_brg_kode
    ) b ON (b.mst_brg_kode = a.brg_kode)
    
    LEFT JOIN (
      SELECT 
        mst_brg_kode, 
        SUM(CASE WHEN mst_noreferensi LIKE '%REC%' THEN mst_Stok_in ELSE 0 END) AS rec,
        SUM(CASE WHEN mst_noreferensi LIKE '%KOR%' THEN mst_Stok_in - mst_stok_out ELSE 0 END) AS kor,
        SUM(CASE WHEN mst_noreferensi LIKE '%MTG%' THEN mst_Stok_in - mst_stok_out ELSE 0 END) AS mut,
        SUM(CASE WHEN mst_noreferensi LIKE '%.MP.%' THEN mst_stok_out ELSE 0 END) AS prod,
        SUM(CASE WHEN mst_noreferensi LIKE '%RET.%' THEN mst_stok_out ELSE 0 END) AS retsup,
        SUM(CASE WHEN mst_noreferensi LIKE '%RETP.%' THEN mst_stok_in ELSE 0 END) AS retprod
      FROM tmasterstok_mmt
      WHERE mst_tanggal BETWEEN ? AND ? AND mst_gdg_kode = 'WH-16'
      GROUP BY mst_brg_kode
    ) c ON (c.mst_brg_kode = a.brg_kode)
    
    LEFT JOIN (
      SELECT mst_brg_kode, SUM(mst_Stok_in - mst_stok_out) AS stok_akhir
      FROM tmasterstok_mmt
      WHERE mst_tanggal <= ? AND mst_gdg_kode = 'WH-16'
      GROUP BY mst_brg_kode
    ) d ON (d.mst_brg_kode = a.brg_kode)
    
    LEFT JOIN tjenisbarang ON (jb_kode = brg_jenis)
    
    WHERE brg_gdg_Default = 'WH-16' AND brg_ktg_kode IN ('BU')
  `;
  
  const [rows] = await pool.query(ssql, [tglMulai, tglMulai, tglSelesai, tglSelesai]);
  return rows;
};

module.exports = {
  getReport
};