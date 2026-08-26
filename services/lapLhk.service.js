const pool = require("../config/db.config");
const { format } = require("date-fns");

// =========================================================================
// HELPER: SUBQUERY GABUNGAN (MMT, TEKSTIL, SUBLIM)
// =========================================================================
/**
 * Menyediakan subquery SQL gabungan dari 3 lini produksi:
 * 1. LHK Cetak (MMT)
 * 2. LHK Mesin Tekstil
 * 3. LHK Sublim
 */
const getUnifiedLhkQuery = () => {
  return `
        SELECT 
            'MMT' AS Kategori,
            h.lnomor AS Nomor_LHK,
            h.ltanggal AS Tanggal,
            h.lshift AS Shift,
            h.loperator AS Operator,
            h.lgdg_prod AS Kode_Gudang,
            g.gdg_nama AS Nama_Gudang,
            h.lmesin AS Mesin,
            d.ld_spk_nomor AS Nomor_SPK,
            IFNULL(s.spk_nama, '-') AS Nama_Order,
            d.ld_total_qtycetak AS Qty_Cetak,
            IFNULL(s.spk_panjang, 0) AS Panjang,
            IFNULL(s.spk_lebar, 0) AS Lebar,
            ROUND(d.ld_total_qtycetak * IFNULL(s.spk_panjang, 0) * IFNULL(s.spk_lebar, 0), 2) AS Total_m2
        FROM tlhk_mesin_hdr h
        JOIN tlhk_mesin_dtl d ON h.lnomor = d.ld_lnomor
        LEFT JOIN tGUDANG g ON g.gdg_kode = h.lgdg_prod
        LEFT JOIN tspk s ON s.spk_nomor = d.ld_spk_nomor
        WHERE h.ltanggal BETWEEN ? AND ?

        UNION ALL

        SELECT 
            'TEKSTIL' AS Kategori,
            h.lth_nomor AS Nomor_LHK,
            h.lth_tanggal AS Tanggal,
            h.lth_shift AS Shift,
            '-' AS Operator,
            h.lth_gdg_prod AS Kode_Gudang,
            g.gdg_nama AS Nama_Gudang,
            d.ltd_jns_mesin AS Mesin,
            d.ltd_spk_nomor AS Nomor_SPK,
            IFNULL(x.spk_nama, '-') AS Nama_Order,
            d.ltd_qty_cetak AS Qty_Cetak,
            IFNULL(x.spk_panjang, 0) AS Panjang,
            IFNULL(x.spk_lebar, 0) AS Lebar,
            ROUND(d.ltd_qty_cetak * IFNULL(x.spk_panjang, 0) * IFNULL(x.spk_lebar, 0), 2) AS Total_m2
        FROM tlhk_mesintekstil_hdr h
        JOIN tlhk_mesintekstil_dtl d ON h.lth_nomor = d.ltd_lth_nomor
        LEFT JOIN tGUDANG g ON g.gdg_kode = h.lth_gdg_prod
        LEFT JOIN (
            SELECT spk_nomor, spk_nama, spk_panjang, spk_lebar FROM tspk
            UNION ALL
            SELECT mspk_nomor, mspk_nama, mspk_panjang, mspk_lebar FROM tmemospk
        ) x ON x.spk_nomor = d.ltd_spk_nomor
        WHERE h.lth_tanggal BETWEEN ? AND ?

        UNION ALL

        SELECT 
            'SUBLIM' AS Kategori,
            h.lsb_nomor AS Nomor_LHK,
            h.lsb_tanggal AS Tanggal,
            h.lsb_shift AS Shift,
            h.lsb_user_create AS Operator,
            h.lsb_gdg_kode AS Kode_Gudang,
            g.gdg_nama AS Nama_Gudang,
            IFNULL(d.lsbd_lokasi, 'SB01') AS Mesin,
            d.lsbd_spk_nomor AS Nomor_SPK,
            IF(LENGTH(IFNULL(d.lsbd_spk_nama, '')) > 0, d.lsbd_spk_nama, IFNULL(x.spk_nama, '-')) AS Nama_Order,
            d.lsbd_jumlah AS Qty_Cetak,
            IFNULL(d.lsbd_panjang, 0) AS Panjang,
            IFNULL(d.lsbd_lebar, 0) AS Lebar,
            IFNULL(d.lsbd_j_meter, (d.lsbd_panjang * d.lsbd_lebar * d.lsbd_jumlah)) AS Total_m2
        FROM tlhk_sublim_hdr h
        JOIN tlhk_sublim_dtl d ON h.lsb_nomor = d.lsbd_lsb_nomor
        LEFT JOIN tGUDANG g ON g.gdg_kode = h.lsb_gdg_kode
        LEFT JOIN (
            SELECT spk_nomor, spk_nama FROM tspk
            UNION ALL
            SELECT mspk_nomor, mspk_nama FROM tmemospk
        ) x ON x.spk_nomor = d.lsbd_spk_nomor
        WHERE h.lsb_tanggal BETWEEN ? AND ?
    `;
};

// =========================================================================
// FUNGSI LAPORAN & AGREGASI
// =========================================================================

/**
 * Ringkasan statistik produksi untuk Dashboard
 */
const getLaporanAgregasi = async (startDate, endDate) => {
  const tglMulai = format(new Date(startDate), "yyyy-MM-dd");
  const tglSelesai = format(new Date(endDate), "yyyy-MM-dd");
  const dateParams = [
    tglMulai,
    tglSelesai,
    tglMulai,
    tglSelesai,
    tglMulai,
    tglSelesai,
  ];

  const unifiedSql = getUnifiedLhkQuery();

  const sqlMesin = `
        SELECT Mesin, Kategori, SUM(Total_m2) as Total_m2
        FROM (${unifiedSql}) u
        GROUP BY Mesin, Kategori
        ORDER BY Total_m2 DESC
    `;

  const sqlHarian = `
        SELECT DATE_FORMAT(Tanggal, '%Y-%m-%d') as Tanggal, 
               SUM(Total_m2) as Total_m2
        FROM (${unifiedSql}) u
        GROUP BY Tanggal
        ORDER BY Tanggal ASC
    `;

  const sqlSPK = `
        SELECT Nomor_SPK as lcd_spk_nomor, 
               Nama_Order as spk_nama, 
               SUM(Qty_Cetak) as Total_Qty,
               SUM(Total_m2) as Total_m2
        FROM (${unifiedSql}) u
        GROUP BY Nomor_SPK, Nama_Order
        ORDER BY Total_m2 DESC
        LIMIT 10
    `;

  const [resMesin] = await pool.query(sqlMesin, dateParams);
  const [resHarian] = await pool.query(sqlHarian, dateParams);
  const [resSPK] = await pool.query(sqlSPK, dateParams);

  return { perMesin: resMesin, perHari: resHarian, perSPK: resSPK };
};

/**
 * Rekap LHK untuk tampilan tabel report
 */
const getRekapLhk = async (startDate, endDate) => {
  const tglMulai = format(new Date(startDate), "yyyy-MM-dd");
  const tglSelesai = format(new Date(endDate), "yyyy-MM-dd");
  const dateParams = [
    tglMulai,
    tglSelesai,
    tglMulai,
    tglSelesai,
    tglMulai,
    tglSelesai,
  ];

  const unifiedSql = getUnifiedLhkQuery();

  const sqlMesin = `
        SELECT 
            u.Mesin,
            u.Kategori,
            COUNT(DISTINCT u.Nomor_SPK) AS Jml_SPK,
            SUM(u.Qty_Cetak) AS Total_Pcs,
            ROUND(SUM(u.Total_m2), 1) AS Total_Meter,
            IFNULL(m.msn_kapasitas, 0) AS Kapasitas 
        FROM (${unifiedSql}) u
        LEFT JOIN tmesin_mmt m ON m.msn_nama = u.Mesin
        GROUP BY u.Mesin, u.Kategori, m.msn_kapasitas
        ORDER BY Total_Meter DESC
    `;

  const sqlHarian = `
        SELECT 
            DATE_FORMAT(u.Tanggal, '%Y-%m-%d') AS Tanggal,
            u.Mesin,
            u.Kategori,
            ROUND(SUM(u.Total_m2), 1) AS Total_Meter
        FROM (${unifiedSql}) u
        GROUP BY Tanggal, u.Mesin, u.Kategori
        ORDER BY Tanggal ASC, u.Mesin ASC
    `;

  const [rekapMesin] = await pool.query(sqlMesin, dateParams);
  const [rekapHarian] = await pool.query(sqlHarian, dateParams);

  return { rekapMesin, rekapHarian };
};

/**
 * Export Excel CrossTab (Mesin vs Tanggal)
 */
const getExportLhkCrossTab = async (month, year) => {
  const sql = `
        SELECT 
            u.Mesin,
            u.Kategori,
            DAY(u.Tanggal) AS Hari,
            SUM(u.Total_m2) AS Total_Meter
        FROM (
            SELECT h.lmesin AS Mesin, 'MMT' AS Kategori, h.ltanggal AS Tanggal, d.ld_luas_m2 AS Total_m2
            FROM tlhk_mesin_hdr h JOIN tlhk_mesin_dtl d ON h.lnomor = d.ld_lnomor
            
            UNION ALL
            
            SELECT d.ltd_jns_mesin AS Mesin, 'TEKSTIL' AS Kategori, h.lth_tanggal AS Tanggal,
                   (d.ltd_qty_cetak * IFNULL(x.spk_panjang,0) * IFNULL(x.spk_lebar,0)) AS Total_m2
            FROM tlhk_mesintekstil_hdr h JOIN tlhk_mesintekstil_dtl d ON h.lth_nomor = d.ltd_lth_nomor
            LEFT JOIN (SELECT spk_nomor, spk_panjang, spk_lebar FROM tspk UNION ALL SELECT mspk_nomor, mspk_panjang, mspk_lebar FROM tmemospk) x ON x.spk_nomor = d.ltd_spk_nomor
            
            UNION ALL
            
            SELECT IFNULL(d.lsbd_lokasi, 'SB01') AS Mesin, 'SUBLIM' AS Kategori, h.lsb_tanggal AS Tanggal,
                   IFNULL(d.lsbd_j_meter, (d.lsbd_panjang * d.lsbd_lebar * d.lsbd_jumlah)) AS Total_m2
            FROM tlhk_sublim_hdr h JOIN tlhk_sublim_dtl d ON h.lsb_nomor = d.lsbd_lsb_nomor
        ) u
        WHERE MONTH(u.Tanggal) = ? AND YEAR(u.Tanggal) = ?
        GROUP BY u.Mesin, u.Kategori, DAY(u.Tanggal)
        ORDER BY u.Mesin ASC, Hari ASC
    `;

  const [rows] = await pool.query(sql, [month, year]);
  return rows;
};

/**
 * Export data detail lengkap ke Excel/CSV
 */
const getAllDataForExport = async (startDate, endDate, mesin) => {
  const tglMulai = format(new Date(startDate), "yyyy-MM-dd");
  const tglSelesai = format(new Date(endDate), "yyyy-MM-dd");

  let dateParams = [
    tglMulai,
    tglSelesai,
    tglMulai,
    tglSelesai,
    tglMulai,
    tglSelesai,
  ];
  let filterMesin = "";
  let extraParams = [];

  if (mesin) {
    const mesinArray = Array.isArray(mesin)
      ? mesin
      : mesin.split(",").filter((m) => m.trim() !== "");
    if (mesinArray.length > 0) {
      filterMesin = ` WHERE u.Mesin IN (${mesinArray.map(() => "?").join(",")})`;
      extraParams = mesinArray;
    }
  }

  const unifiedSql = getUnifiedLhkQuery();

  const sql = `
        SELECT 
            u.Kategori,
            u.Nomor_LHK,
            DATE_FORMAT(u.Tanggal, '%d/%m/%Y') AS Tanggal,
            u.Shift AS Shift_LHK,
            u.Operator AS Operator_LHK,
            u.Nama_Gudang AS Gudang,
            u.Nomor_SPK,
            u.Nama_Order,
            u.Mesin,
            u.Qty_Cetak,
            u.Panjang,
            u.Lebar,
            u.Total_m2 AS m2_cetak
        FROM (${unifiedSql}) u
        ${filterMesin}
        ORDER BY u.Tanggal DESC, u.Nomor_LHK DESC
    `;

  const [rows] = await pool.query(sql, [...dateParams, ...extraParams]);
  return rows;
};

/**
 * Detail pengerjaan SPK per mesin tertentu
 */
const getDetailRekapMesin = async (startDate, endDate, mesin) => {
  const tglMulai = format(new Date(startDate), "yyyy-MM-dd");
  const tglSelesai = format(new Date(endDate), "yyyy-MM-dd");
  const dateParams = [
    tglMulai,
    tglSelesai,
    tglMulai,
    tglSelesai,
    tglMulai,
    tglSelesai,
  ];

  const unifiedSql = getUnifiedLhkQuery();

  const sql = `
        SELECT 
            u.Nomor_SPK AS No_SPK,
            u.Nama_Order,
            u.Kategori,
            SUM(u.Qty_Cetak) AS Total_Pcs,
            SUM(u.Total_m2) AS Total_Meter
        FROM (${unifiedSql}) u
        WHERE u.Mesin = ?
        GROUP BY u.Nomor_SPK, u.Nama_Order, u.Kategori
        ORDER BY Total_Meter DESC
    `;

  const [rows] = await pool.query(sql, [...dateParams, mesin]);
  return rows;
};

module.exports = {
  getLaporanAgregasi,
  getRekapLhk,
  getExportLhkCrossTab,
  getAllDataForExport,
  getDetailRekapMesin,
};
