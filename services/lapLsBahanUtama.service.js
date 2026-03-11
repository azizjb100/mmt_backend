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
      a.brg_kode AS kode, 
      a.brg_nama AS Nama, 
      jb.jb_nama, 
      CASE 
          WHEN a.brg_status = 'F' THEN 'Fast Moving'
          WHEN a.brg_status = 'S' THEN 'Slow Moving'
          WHEN a.brg_status = 'N' THEN 'Non Flexy'
          ELSE ''
      END AS status_barang,

      /* --- SPESIFIKASI MURNI --- */
      IFNULL(a.brg_panjang, 0) AS Panjang,
      IFNULL(a.brg_lebar, 0) AS Lebar,
      (IFNULL(a.brg_panjang, 0) * IFNULL(a.brg_lebar, 0)) AS m2,

      /* ================= STOK AWAL ================= */
      IFNULL(b.stok_awal_q, 0) AS stok_awal_q,
      IFNULL(b.stok_awal_m, 0) AS stok_awal_m,
      IFNULL(b.stok_awal_m, 0) * IFNULL(c.harga_referensi, 0) AS stok_awal_nominal,

      /* ================= MUTASI MASUK (TERIMA) ================= */
      IFNULL(c.terima_q, 0) AS terima_q,
      IFNULL(c.terima_m, 0) AS terima_m,
      IFNULL(c.nilai_masuk_total, 0) AS terima_nominal,

      /* ================= MUTASI KELUAR ================= */
      IFNULL(c.keluar_q, 0) AS keluar_q,
      IFNULL(c.keluar_m, 0) AS keluar_m,
      IFNULL(c.keluar_m, 0) * IFNULL(c.harga_referensi, 0) AS keluar_nominal,

      /* ================= STOK AKHIR ================= */
      IFNULL(d.stok_akhir_q, 0) AS stok_akhir_q,
      IFNULL(d.stok_akhir_m, 0) AS stok_akhir_m,
      IFNULL(d.stok_akhir_m, 0) * IFNULL(c.harga_referensi, 0) AS stok_akhir_nominal

    FROM tbarang_mmt a

    /* Subquery b: Stok Awal */
    LEFT JOIN (
      SELECT 
        mst_brg_kode, 
        SUM(mst_stok_in - mst_stok_out) AS stok_awal_q,
        SUM((mst_stok_in - mst_stok_out) * (IFNULL(mst_panjang, 0) * IFNULL(mst_lebar, 0))) AS stok_awal_m
      FROM tmasterstok_mmt
      WHERE mst_tanggal < ? AND mst_gdg_kode = ?
      GROUP BY mst_brg_kode
    ) b ON b.mst_brg_kode = a.brg_kode

    /* Subquery c: Mutasi & Harga (LOGIKA BARU) */
    LEFT JOIN (
      SELECT 
        mst_brg_kode,
        /* Mutasi tetap difilter berdasarkan range tanggal inputan */
        SUM(CASE WHEN mst_tanggal BETWEEN ? AND ? THEN mst_stok_in ELSE 0 END) AS terima_q,
        SUM(CASE WHEN mst_tanggal BETWEEN ? AND ? THEN mst_stok_out ELSE 0 END) AS keluar_q,
        SUM(CASE WHEN mst_tanggal BETWEEN ? AND ? THEN (mst_stok_in * (IFNULL(mst_panjang, 0) * IFNULL(mst_lebar, 0))) ELSE 0 END) AS terima_m,
        SUM(CASE WHEN mst_tanggal BETWEEN ? AND ? THEN (mst_stok_out * (IFNULL(mst_panjang, 0) * IFNULL(mst_lebar, 0))) ELSE 0 END) AS keluar_m,
        
        /* Harga mengambil histori sampai tanggal akhir agar data lama (Januari) ikut terhitung */
        AVG(
          CASE 
            WHEN LOWER(mst_satuan_harga) = 'm2' 
              THEN mst_hargabeli
            ELSE 
              mst_hargabeli / NULLIF((IFNULL(mst_panjang, 0) * IFNULL(mst_lebar, 0)), 0)
          END
        ) AS harga_referensi,

        /* Nilai nominal barang masuk sesuai periode */
        SUM(
          CASE 
            WHEN mst_tanggal BETWEEN ? AND ? THEN
              CASE 
                WHEN LOWER(mst_satuan_harga) = 'm2' 
                  THEN (mst_stok_in * (IFNULL(mst_panjang, 0) * IFNULL(mst_lebar, 0))) * mst_hargabeli
                ELSE 
                  mst_stok_in * mst_hargabeli
              END
            ELSE 0 
          END
        ) AS nilai_masuk_total

      FROM tmasterstok_mmt
      WHERE mst_tanggal <= ? AND mst_gdg_kode = ?
      GROUP BY mst_brg_kode
    ) c ON c.mst_brg_kode = a.brg_kode

    /* Subquery d: Stok Akhir */
    LEFT JOIN (
      SELECT 
        mst_brg_kode, 
        SUM(mst_stok_in - mst_stok_out) AS stok_akhir_q,
        SUM((mst_stok_in - mst_stok_out) * (IFNULL(mst_panjang, 0) * IFNULL(mst_lebar, 0))) AS stok_akhir_m
      FROM tmasterstok_mmt
      WHERE mst_tanggal <= ? AND mst_gdg_kode = ?
      GROUP BY mst_brg_kode
    ) d ON d.mst_brg_kode = a.brg_kode

    LEFT JOIN tjenisbarang jb ON jb.jb_kode = a.brg_jenis
    WHERE a.brg_ktg_kode IN ('BU')
    ORDER BY a.brg_nama ASC
  `;

  /* Penyesuaian urutan params agar sesuai dengan tanda tanya (?) di query */
  const params = [
    tglMulai, kodeGudang,                             // Subquery b
    tglMulai, tglSelesai,                             // Subquery c (terima_q)
    tglMulai, tglSelesai,                             // Subquery c (keluar_q)
    tglMulai, tglSelesai,                             // Subquery c (terima_m)
    tglMulai, tglSelesai,                             // Subquery c (keluar_m)
    tglMulai, tglSelesai,                             // Subquery c (nilai_masuk_total)
    tglSelesai, kodeGudang,                           // Subquery c (WHERE & harga_referensi)
    tglSelesai, kodeGudang                            // Subquery d
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
  return rows[0];
};

module.exports = {
  getReport,
  getTotalRollSekarang

};