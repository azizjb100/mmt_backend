const pool = require('../config/db.config');
const moment = require('moment');

/**
 * Service untuk menarik data Laporan Monitoring Sublim
 * @param {string} startDate - Format 'YYYY-MM-DD'
 * @param {string} endDate - Format 'YYYY-MM-DD'
 */
const lapMonSublim = async (startDate, endDate) => {
  const tglMulai = moment(startDate).format('YYYY-MM-DD');
  const tglSelesai = moment(endDate).format('YYYY-MM-DD');

  // Query SQL hasil translasi dari Delphi TfrmLapMon_Sublim.loaddata (ssql)
const ssql = `
    SELECT 
        NULL AS poi_nomor, 
        NULL AS poi_tanggal, 
        NULL AS poi_dateline, 
        NULL AS poi_spk_nomor, 
        NULL AS poid_size, 
        NULL AS poid_jumlah,
        X.*, 
        Y.*,
        (X.lsbd_panjang * X.lsbd_lebar * X.lsbd_jumlah_order) AS meter_order, 
        (X.lsbd_jumlah_order - X.lsbd_jumlah) AS kurang,
        IF(X.sb01 = 0, 0, IF(Y.spk_jumlah - X.lsbd_jumlah < 0, X.sb01 + (Y.spk_jumlah - X.sb01), X.sb01)) AS sb01_std,
        IF(X.sb02 = 0, 0, IF(Y.spk_jumlah - X.lsbd_jumlah < 0, X.sb02 + (Y.spk_jumlah - X.sb02), X.sb02)) AS sb02_std,
        IF(X.sb03 = 0, 0, IF(Y.spk_jumlah - X.lsbd_jumlah < 0, X.sb03 + (Y.spk_jumlah - X.sb03), X.sb03)) AS sb03_std,
        IF(X.lsbd_jumlah = 0, 0, IF(X.lsbd_jumlah_order - X.lsbd_jumlah < 0, X.lsbd_jumlah + (X.lsbd_jumlah_order - X.lsbd_jumlah), X.lsbd_jumlah)) AS pcs_std,
        IF(X.sb01 = 0, 0, IF(Y.spk_jumlah - X.lsbd_jumlah < 0, X.sb01 + (Y.spk_jumlah - X.sb01), X.sb01)) * X.lsbd_panjang * X.lsbd_lebar AS sb01_std_m,
        IF(X.sb02 = 0, 0, IF(Y.spk_jumlah - X.lsbd_jumlah < 0, X.sb02 + (Y.spk_jumlah - X.sb02), X.sb02)) * X.lsbd_panjang * X.lsbd_lebar AS sb02_std_m,
        IF(X.sb03 = 0, 0, IF(Y.spk_jumlah - X.lsbd_jumlah < 0, X.sb03 + (Y.spk_jumlah - X.sb03), X.sb03)) * X.lsbd_panjang * X.lsbd_lebar AS sb03_std_m,
        IF(X.lsbd_jumlah = 0, 0, IF(Y.spk_jumlah - X.lsbd_jumlah < 0, X.lsbd_jumlah + (X.lsbd_jumlah_order - X.lsbd_jumlah), X.lsbd_jumlah)) * X.lsbd_panjang * X.lsbd_lebar AS meter_std
    FROM (
        SELECT 
            lsbd_lsb_nomor, 
            lsbd_spk_nomor,
            lsbd_panjang, 
            lsbd_lebar,
            ROUND(CONCAT(SUM(IF(lsbd_lokasi = 'SB01', lsbd_jumlah, 0))), 0) AS sb01,
            ROUND(CONCAT(SUM(IF(lsbd_lokasi = 'SB02', lsbd_jumlah, 0))), 0) AS sb02,
            ROUND(CONCAT(SUM(IF(lsbd_lokasi = 'SB03', lsbd_jumlah, 0))), 0) AS sb03,
            ROUND(CONCAT(SUM(lsbd_jumlah)), 0) AS lsbd_jumlah,
            SUM(lsbd_jumlah_order) AS lsbd_jumlah_order,
            SUM(IF(lsbd_lokasi = 'SB01', lsbd_jumlah, 0) * lsbd_panjang) AS sb01_m,
            SUM(IF(lsbd_lokasi = 'SB02', lsbd_jumlah, 0) * lsbd_panjang) AS sb02_m,
            SUM(IF(lsbd_lokasi = 'SB03', lsbd_jumlah, 0) * lsbd_panjang) AS sb03_m,
            SUM(lsbd_jumlah * lsbd_panjang) AS lsbd_jumlah_m, 
            lsbd_bahan, 
            lsb_gdg_kode,
            lsbd_poi_nomor, 
            lsbd_poid_size
        FROM (
            SELECT a.*, b.*
            FROM tlhk_sublim_dtl a
            INNER JOIN tlhk_sublim_hdr b ON (b.lsb_nomor = a.lsbd_lsb_nomor)
            WHERE b.lsb_tanggal BETWEEN ? AND ?
        ) xx
        GROUP BY lsbd_lsb_nomor, lsbd_spk_nomor, lsbd_panjang, lsbd_lebar, lsbd_bahan, lsb_gdg_kode, lsbd_poi_nomor, lsbd_poid_size
    ) X
    LEFT JOIN tspk Y ON (Y.spk_nomor = X.lsbd_spk_nomor)

    UNION ALL

    SELECT 
        X.*, 
        Y.*, 
        (X.lsbd_panjang * X.lsbd_lebar * X.lsbd_jumlah_order) AS meter_order, 
        (X.lsbd_jumlah_order - X.lsbd_jumlah) AS kurang,
        IF(X.sb01 = 0, 0, IF(Y.spk_jumlah - X.lsbd_jumlah < 0, X.sb01 + (Y.spk_jumlah - X.sb01), X.sb01)) AS sb01_std,
        IF(X.sb02 = 0, 0, IF(Y.spk_jumlah - X.lsbd_jumlah < 0, X.sb02 + (Y.spk_jumlah - X.sb02), X.sb02)) AS sb02_std,
        IF(X.sb03 = 0, 0, IF(Y.spk_jumlah - X.lsbd_jumlah < 0, X.sb03 + (Y.spk_jumlah - X.sb03), X.sb03)) AS sb03_std,
        IF(X.lsbd_jumlah = 0, 0, IF(X.lsbd_jumlah_order - X.lsbd_jumlah < 0, X.lsbd_jumlah + (X.lsbd_jumlah_order - X.lsbd_jumlah), X.lsbd_jumlah)) AS pcs_std,
        IF(X.sb01 = 0, 0, IF(Y.spk_jumlah - X.lsbd_jumlah < 0, X.sb01 + (Y.spk_jumlah - X.sb01), X.sb01)) * X.lsbd_panjang * X.lsbd_lebar AS sb01_std_m,
        IF(X.sb02 = 0, 0, IF(Y.spk_jumlah - X.lsbd_jumlah < 0, X.sb02 + (Y.spk_jumlah - X.sb02), X.sb02)) * X.lsbd_panjang * X.lsbd_lebar AS sb02_std_m,
        IF(X.sb03 = 0, 0, IF(Y.spk_jumlah - X.lsbd_jumlah < 0, X.sb03 + (Y.spk_jumlah - X.sb03), X.sb03)) * X.lsbd_panjang * X.lsbd_lebar AS sb03_std_m,
        IF(X.lsbd_jumlah = 0, 0, IF(Y.spk_jumlah - X.lsbd_jumlah < 0, X.lsbd_jumlah + (X.lsbd_jumlah_order - X.lsbd_jumlah), X.lsbd_jumlah)) * X.lsbd_panjang * X.lsbd_lebar AS meter_std
    FROM (
        SELECT a.*, b.* 
        FROM (
            SELECT poi_nomor, poi_tanggal, poi_dateline, poi_spk_nomor, poid_size, poid_jumlah
            FROM tpointernal_hdr 
            INNER JOIN tpointernal_dtl ON (poid_nomor = poi_nomor)
            WHERE poi_sup = 'P05'
              AND poid_bhn_kode = 'LL-000400'
              AND poi_tanggal BETWEEN ? AND ?
        ) a
        LEFT JOIN (
            SELECT 
                lsbd_lsb_nomor, 
                lsbd_spk_nomor,
                lsbd_panjang, 
                lsbd_lebar,
                ROUND(CONCAT(SUM(IF(lsbd_lokasi = 'SB01', lsbd_jumlah, 0))), 0) AS sb01,
                ROUND(CONCAT(SUM(IF(lsbd_lokasi = 'SB02', lsbd_jumlah, 0))), 0) AS sb02,
                ROUND(CONCAT(SUM(IF(lsbd_lokasi = 'SB03', lsbd_jumlah, 0))), 0) AS sb03,
                ROUND(CONCAT(SUM(lsbd_jumlah)), 0) AS lsbd_jumlah,
                SUM(lsbd_jumlah_order) AS lsbd_jumlah_order,
                SUM(IF(lsbd_lokasi = 'SB01', lsbd_jumlah, 0) * lsbd_panjang) AS sb01_m,
                SUM(IF(lsbd_lokasi = 'SB02', lsbd_jumlah, 0) * lsbd_panjang) AS sb02_m,
                SUM(IF(lsbd_lokasi = 'SB03', lsbd_jumlah, 0) * lsbd_panjang) AS sb03_m,
                SUM(lsbd_jumlah * lsbd_panjang) AS lsbd_jumlah_m, 
                lsbd_bahan, 
                lsb_gdg_kode,
                lsbd_poi_nomor, 
                lsbd_poid_size
            FROM (
                SELECT a.*, b.*
                FROM tlhk_sublim_dtl a
                INNER JOIN tlhk_sublim_hdr b ON (b.lsb_nomor = a.lsbd_lsb_nomor)
                WHERE b.lsb_tanggal BETWEEN ? AND ?
            ) xx
            GROUP BY lsbd_lsb_nomor, lsbd_spk_nomor, lsbd_panjang, lsbd_lebar, lsbd_bahan, lsb_gdg_kode, lsbd_poi_nomor, lsbd_poid_size
        ) b ON (b.lsbd_poi_nomor = a.poi_nomor AND b.lsbd_poid_size = a.poid_size)
    ) X
    LEFT JOIN tspk Y ON (Y.spk_nomor = X.poi_spk_nomor)
    
    ORDER BY spk_tanggal ASC
    LIMIT 1000
  `;

  // Total ada 6 parameter tanda tanya (?) untuk filter tanggal di dalam query UNION
  const params = [
    tglMulai, tglSelesai, // Blok pertama (tlhk_sublim_hdr)
    tglMulai, tglSelesai, // Blok kedua bagian 1 (tpointernal_hdr)
    tglMulai, tglSelesai  // Blok kedua bagian 2 (tlhk_sublim_hdr didalam subquery PO)
  ];

  let connection;
  try {
    connection = await pool.getConnection();

    console.time('QUERY LAP MON SUBLIM');
    const [rows] = await connection.execute(ssql, params);
    console.timeEnd('QUERY LAP MON SUBLIM');

    return rows;
  } catch (error) {
    console.error('Backend Error lapMonSublim:', error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { lapMonSublim };