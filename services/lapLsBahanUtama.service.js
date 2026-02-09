// backend/services/lapLsBahanBaku.service.js
const pool = require('../config/db.config'); // Pastikan path ini benar
const { format } = require('date-fns');

/**
 * Mengambil Laporan List Stok Bahan Baku
 * (Logika dari loaddata)
 */
const getReport = async (startDate, endDate) => {
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
      
      /* 1. STOK AWAL: Benar-benar saldo sebelum tglMulai */
      IFNULL(b.stok_awal, 0) AS stok_awal_q,
      IFNULL(b.stok_awal, 0) * (IFNULL(brg_panjang, 0) * (IFNULL(brg_lebar, 0) - 0.1)) AS stok_awal_m,
      
      /* 2. TERIMA: Semua yang masuk (IN) di dalam periode */
      IFNULL(c.total_masuk, 0) AS terima_q,
      IFNULL(c.total_masuk, 0) * (IFNULL(brg_panjang, 0) * (IFNULL(brg_lebar, 0) - 0.1)) AS terima_m,
      
      /* 3. KELUAR: Semua yang keluar (OUT) di dalam periode */
      IFNULL(c.total_keluar, 0) AS keluar_q,
      IFNULL(c.total_keluar, 0) * (IFNULL(brg_panjang, 0) * (IFNULL(brg_lebar, 0) - 0.1)) AS keluar_m,
      
      /* 4. RETUR: Khusus Retur Produksi (Masuk lagi) */
      IFNULL(c.retprod, 0) AS retur_q,
      IFNULL(c.retprod, 0) * (IFNULL(brg_panjang, 0) * (IFNULL(brg_lebar, 0) - 0.1)) AS retur_m,
      
      /* 5. STOK AKHIR: Saldo sampai dengan tglSelesai */
      IFNULL(d.stok_akhir, 0) AS stok_akhir_q,
      IFNULL(d.stok_akhir, 0) * (IFNULL(brg_panjang, 0) * (IFNULL(brg_lebar, 0) - 0.1)) AS stok_akhir_m
      
    FROM tbarang_mmt a
    
    /* LEFT JOIN B: Menghitung Saldo SEBELUM periode dimulai */
    LEFT JOIN (
      SELECT mst_brg_kode, SUM(mst_Stok_in - mst_stok_out) AS stok_awal
      FROM tmasterstok_mmt
      WHERE mst_tanggal < ? AND mst_gdg_kode = 'WH-16'
      GROUP BY mst_brg_kode
    ) b ON (b.mst_brg_kode = a.brg_kode)
    
    /* LEFT JOIN C: Menghitung Mutasi HANYA di dalam periode */
    LEFT JOIN (
      SELECT 
        mst_brg_kode, 
        /* Menghitung semua penambahan stok */
        SUM(CASE 
            WHEN (mst_noreferensi LIKE '%REC%' OR mst_noreferensi LIKE '%KOR%' OR mst_noreferensi LIKE '%MTG%') 
            AND (mst_Stok_in > 0) THEN mst_Stok_in 
            ELSE 0 END) AS total_masuk,
            
        /* Menghitung semua pengurangan stok */
        SUM(CASE 
            WHEN (mst_noreferensi LIKE '%.MP.%' OR mst_noreferensi LIKE '%RET.%' OR (mst_stok_out > 0)) 
            AND mst_noreferensi NOT LIKE '%RETP.%' THEN mst_stok_out 
            ELSE 0 END) AS total_keluar,
            
        /* Khusus Retur Produksi (Masuk) */
        SUM(CASE WHEN mst_noreferensi LIKE '%RETP.%' THEN mst_stok_in ELSE 0 END) AS retprod
      FROM tmasterstok_mmt
      WHERE mst_tanggal BETWEEN ? AND ? AND mst_gdg_kode = 'WH-16'
      GROUP BY mst_brg_kode
    ) c ON (c.mst_brg_kode = a.brg_kode)
    
    /* LEFT JOIN D: Menghitung Saldo AKHIR periode */
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