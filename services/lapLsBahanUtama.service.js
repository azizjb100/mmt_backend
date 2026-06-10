// backend/services/lapLsBahanBaku.service.js
const pool = require('../config/db.config'); // Pastikan path ini benar
const { format } = require('date-fns');

/**
 * Mengambil Laporan List Stok Bahan Baku
 * (Logika dari loaddata - Sudah disesuaikan dengan filter SCRAP agar stok akhir tidak kosong)
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
          WHEN a.brg_status = 'R' THEN 'Regular'
          ELSE ''
      END AS status_barang,

      CASE 
          WHEN a.brg_type = 'F' THEN 'FLEXY'
          WHEN a.brg_type = 'NF' THEN 'NON FLEXY'
          WHEN a.brg_type = 'K' THEN 'KAIN'
          WHEN a.brg_type = 'P' THEN 'PAPER'
          ELSE ''
      END AS type_barang,

      IFNULL(a.brg_panjang, 0) AS Panjang,
      IFNULL(a.brg_lebar, 0) AS Lebar,
      CASE 
        WHEN a.brg_type = 'K' THEN IFNULL(a.brg_panjang, 0)
        ELSE (IFNULL(a.brg_panjang, 0) * IFNULL(a.brg_lebar, 0))
      END AS m2,

      /* ================= STOK AWAL ================= */
      IFNULL(b.stok_awal_q, 0) AS stok_awal_q,
      IFNULL(b.stok_awal_m, 0) AS stok_awal_m,
      IFNULL(b.stok_awal_m, 0) * IFNULL(c.harga_referensi, 0) AS stok_awal_nominal,

      /* ================= MUTASI MASUK (TERIMA) ================= */
      IFNULL(c.terima_q, 0) AS terima_q,
      IFNULL(c.terima_m, 0) AS terima_m,
      IFNULL(c.nilai_masuk_total, 0) AS terima_nominal,

      /* ================= MUTASI RETUR ================= */
      IFNULL(c.retur_q, 0) AS retur_q,
      IFNULL(c.retur_m, 0) AS retur_m,
      IFNULL(c.retur_m, 0) * IFNULL(c.harga_referensi, 0) AS retur_nominal,

      /* ================= MUTASI KELUAR ================= */
      IFNULL(c.keluar_q, 0) AS keluar_q,
      IFNULL(c.keluar_m, 0) AS keluar_m,
      IFNULL(c.keluar_m, 0) * IFNULL(c.harga_referensi, 0) AS keluar_nominal,

      /* ================= STOK AKHIR ================= */
      -- Di hilangkan fungsi SUM() nya agar tidak bentrok dengan row individual barang
      IFNULL(d.stok_akhir_q, 0) AS stok_akhir_q,
    
      -- PERBAIKAN: Formula balancing murni antar-kolom per baris barang (Awal + Terima + Retur - Keluar)
      (IFNULL(b.stok_awal_m, 0) + IFNULL(c.terima_m, 0) + IFNULL(c.retur_m, 0) - IFNULL(c.keluar_m, 0)) AS stok_akhir_m,
    
      -- Nominal Akhir dikalikan hasil balancing di atas
      (IFNULL(b.stok_awal_m, 0) + IFNULL(c.terima_m, 0) + IFNULL(c.retur_m, 0) - IFNULL(c.keluar_m, 0)) * IFNULL(c.harga_referensi, 0) AS stok_akhir_nominal

    FROM tbarang_mmt a

    /* Subquery b: Stok Awal (Mencakup ROLL, RETUR, dan SCRAP) */
    LEFT JOIN (
      SELECT 
        s.mst_brg_kode, 
        SUM(s.mst_stok_in - s.mst_stok_out) AS stok_awal_q,
        SUM((s.mst_stok_in - s.mst_stok_out) * CASE 
            WHEN brg.brg_type = 'K' THEN IFNULL(s.mst_panjang, 0)
            ELSE (IFNULL(s.mst_panjang, 0) * IFNULL(s.mst_lebar, 0))
          END
        ) AS stok_awal_m
      FROM tmasterstok_mmt s
      JOIN tbarang_mmt brg ON s.mst_brg_kode = brg.brg_kode
      WHERE s.mst_tanggal < ? 
        AND s.mst_gdg_kode = ?
        AND (s.mst_kategori IN ('ROLL', 'RETUR', 'SCRAP') OR s.mst_kategori IS NULL)
      GROUP BY s.mst_brg_kode
    ) b ON b.mst_brg_kode = a.brg_kode

    /* Subquery c: Mutasi Terpisah & Harga */
    LEFT JOIN (
      SELECT 
        s.mst_brg_kode,
        SUM(CASE WHEN (s.mst_tanggal BETWEEN ? AND ?) AND (s.mst_kategori NOT IN ('RETUR', 'SCRAP') OR s.mst_kategori IS NULL) THEN s.mst_stok_in ELSE 0 END) AS terima_q,
        SUM(CASE WHEN (s.mst_tanggal BETWEEN ? AND ?) AND (s.mst_kategori NOT IN ('RETUR', 'SCRAP') OR s.mst_kategori IS NULL) THEN s.mst_stok_out ELSE 0 END) AS keluar_q,
        
        SUM(CASE WHEN (s.mst_tanggal BETWEEN ? AND ?) AND s.mst_kategori = 'RETUR' THEN s.mst_stok_in ELSE 0 END) AS retur_q,

        SUM(CASE WHEN (s.mst_tanggal BETWEEN ? AND ?) AND (s.mst_kategori NOT IN ('RETUR', 'SCRAP') OR s.mst_kategori IS NULL) THEN 
            (s.mst_stok_in * CASE 
                WHEN brg.brg_type = 'K' THEN IFNULL(s.mst_panjang, 0)
                ELSE (IFNULL(s.mst_panjang, 0) * IFNULL(s.mst_lebar, 0))
            END) 
        ELSE 0 END) AS terima_m,

        SUM(CASE WHEN (s.mst_tanggal BETWEEN ? AND ?) AND (s.mst_kategori NOT IN ('RETUR', 'SCRAP') OR s.mst_kategori IS NULL) THEN 
            (s.mst_stok_out * CASE 
                WHEN brg.brg_type = 'K' THEN IFNULL(s.mst_panjang, 0)
                ELSE (IFNULL(s.mst_panjang, 0) * IFNULL(s.mst_lebar, 0))
            END) 
        ELSE 0 END) AS keluar_m,

        SUM(CASE WHEN (s.mst_tanggal BETWEEN ? AND ?) AND s.mst_kategori = 'RETUR' THEN 
            (s.mst_stok_in * CASE 
                WHEN brg.brg_type = 'K' THEN IFNULL(s.mst_panjang, 0)
                ELSE (IFNULL(s.mst_panjang, 0) * IFNULL(s.mst_lebar, 0))
            END) 
        ELSE 0 END) AS retur_m,
        
        AVG(
          CASE 
            WHEN LOWER(s.mst_satuan_harga) = 'm2' OR (brg.brg_type = 'K' AND LOWER(s.mst_satuan_harga) = 'm')
              THEN s.mst_hargabeli
            ELSE 
              s.mst_hargabeli / NULLIF(
                CASE 
                    WHEN brg.brg_type = 'K' THEN IFNULL(s.mst_panjang, 0)
                    ELSE (IFNULL(s.mst_panjang, 0) * IFNULL(s.mst_lebar, 0))
                END, 0)
          END
        ) AS harga_referensi,

        SUM(
          CASE WHEN (s.mst_tanggal BETWEEN ? AND ?) AND (s.mst_kategori NOT IN ('RETUR', 'SCRAP') OR s.mst_kategori IS NULL) THEN
              CASE 
                WHEN LOWER(s.mst_satuan_harga) = 'm2' OR (brg.brg_type = 'K' AND LOWER(s.mst_satuan_harga) = 'm')
                  THEN (s.mst_stok_in * CASE 
                        WHEN brg.brg_type = 'K' THEN IFNULL(s.mst_panjang, 0)
                        ELSE (IFNULL(s.mst_panjang, 0) * IFNULL(s.mst_lebar, 0))
                    END) * s.mst_hargabeli
                ELSE 
                  s.mst_stok_in * s.mst_hargabeli
              END
          ELSE 0 END
        ) AS nilai_masuk_total

      FROM tmasterstok_mmt s
      JOIN tbarang_mmt brg ON s.mst_brg_kode = brg.brg_kode
      WHERE s.mst_tanggal <= ? 
        AND s.mst_gdg_kode = ?
        AND (s.mst_kategori IN ('ROLL', 'RETUR', 'SCRAP') OR s.mst_kategori IS NULL)
      GROUP BY s.mst_brg_kode
    ) c ON c.mst_brg_kode = a.brg_kode

    /* Subquery d: Stok Akhir (Mencakup ROLL, RETUR, dan SCRAP) */
    LEFT JOIN (
      SELECT 
        s.mst_brg_kode, 
        SUM(s.mst_stok_in - s.mst_stok_out) AS stok_akhir_q,
        SUM((s.mst_stok_in - s.mst_stok_out) * CASE 
              WHEN brg.brg_type = 'K' THEN IFNULL(s.mst_panjang, 0)
              ELSE (IFNULL(s.mst_panjang, 0) * IFNULL(s.mst_lebar, 0))
          END
        ) AS stok_akhir_m
      FROM tmasterstok_mmt s
      JOIN tbarang_mmt brg ON s.mst_brg_kode = brg.brg_kode
      WHERE s.mst_tanggal <= ? 
        AND s.mst_gdg_kode = ?
        AND (s.mst_kategori IN ('ROLL', 'RETUR', 'SCRAP') OR s.mst_kategori IS NULL)
      GROUP BY s.mst_brg_kode
    ) d ON d.mst_brg_kode = a.brg_kode

    LEFT JOIN tjenisbarang jb ON jb.jb_kode = a.brg_jenis
    WHERE a.brg_ktg_kode IN ('BU')
    ORDER BY a.brg_nama ASC
  `;

  const params = [
    tglMulai, kodeGudang,                               // Subquery b
    tglMulai, tglSelesai,                               // Subquery c (terima_q)
    tglMulai, tglSelesai,                               // Subquery c (keluar_q)
    tglMulai, tglSelesai,                               // Subquery c (retur_q)
    tglMulai, tglSelesai,                               // Subquery c (terima_m)
    tglMulai, tglSelesai,                               // Subquery c (keluar_m)
    tglMulai, tglSelesai,                               // Subquery c (retur_m)
    tglMulai, tglSelesai,                               // Subquery c (nilai_masuk_total)
    tglSelesai, kodeGudang,                             // Subquery c (WHERE)
    tglSelesai, kodeGudang                              // Subquery d
  ];

  const [rows] = await pool.query(ssql, params);
  return rows;
};


const getTotalRollSekarang = async () => {
  const ssql = `
    SELECT 
      SUM(IFNULL(b.stok_sekarang, 0)) AS total_roll,
      COUNT(a.brg_kode) AS total_jenis_barang,
      SUM(IFNULL(b.total_masuk, 0)) AS total_incoming,
      SUM(IFNULL(b.total_keluar, 0)) AS total_outgoing
    FROM tbarang_mmt a
    LEFT JOIN (
      SELECT 
        mst_brg_kode, 
        SUM(mst_Stok_in) AS total_masuk,
        SUM(mst_stok_out) AS total_keluar,
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

const getFlow6Bulan = async () => {
  const ssql = `
    SELECT 
      DATE_FORMAT(mst_tanggal, '%M %Y') AS bulan, 
      SUM(mst_Stok_in) AS masuk,
      SUM(mst_stok_out) AS keluar
    FROM tmasterstok_mmt
    WHERE mst_gdg_kode = 'WH-16'
      AND mst_tanggal >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    GROUP BY DATE_FORMAT(mst_tanggal, '%M %Y'), YEAR(mst_tanggal), MONTH(mst_tanggal)
    ORDER BY YEAR(mst_tanggal) ASC, MONTH(mst_tanggal) ASC
  `;

  const [rows] = await pool.query(ssql);
  return rows;
};

module.exports = {
  getReport,
  getTotalRollSekarang,
  getFlow6Bulan
};