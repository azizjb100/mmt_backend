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

  // PERBAIKAN: Mengeluarkan lsbd_lsb_nomor dari GROUP BY agar data LHK yang berbeda otomatis ter-SUM (akumulasi)
  const ssql = `
    SELECT 
        NULL AS poi_nomor, 
        NULL AS poi_tanggal, 
        NULL AS poi_dateline, 
        NULL AS poi_spk_nomor, 
        NULL AS poid_size, 
        NULL AS poid_jumlah,
        X.*, 
        
        -- Bagian Pemotong Datetime menjadi Date untuk tabel Y (tspk) --
        Y.spk_nomor,
        DATE_FORMAT(Y.spk_tanggal, '%Y-%m-%d') AS spk_tanggal,
        Y.spk_cus_kode, Y.spk_cus_kaosan, Y.spk_jo_kode, Y.spk_divisi, Y.spk_nama,
        Y.spk_jumlah, Y.spk_jumlah_jadi, Y.spk_prasj, Y.spk_jumlah_kirim, Y.spk_jumlah_inv,
        Y.spk_ukuran, Y.spk_kain, Y.spk_finishing,
        DATE_FORMAT(Y.spk_dateline, '%Y-%m-%d') AS spk_dateline, 
        DATE_FORMAT(Y.spk_datelinepo, '%Y-%m-%d') AS spk_datelinepo,
        Y.spk_cab, Y.spk_workshop, Y.spk_keterangan, Y.spk_ketbeli, Y.spk_image, Y.spk_harga,
        Y.spk_status_stbj, Y.spk_status_inv, 
        DATE_FORMAT(Y.date_create, '%Y-%m-%d') AS date_create,
        Y.date_modified, Y.user_create, Y.user_modified, Y.spk_perush_kode, Y.spk_pen_nomor,
        Y.spk_pen_id, Y.spk_nama2, Y.spk_jumlah_retur, Y.spk_nomor_po, 
        DATE_FORMAT(Y.spk_tgl_po, '%Y-%m-%d') AS spk_tgl_po,
        Y.spk_ketpo, Y.spk_sal_kode, Y.spk_nomormemo, Y.spk_mspk_nomor, Y.spk_memo,
        Y.spk_closed_produksi, Y.spk_tanggal_closed, Y.spk_alasanpending, Y.spk_panjang,
        Y.spk_lebar, Y.spk_hargariil, Y.spk_hargafee, Y.spk_gramasi, Y.spk_statuskerja,
        Y.spk_warna_badan, Y.spk_warna_lengan, Y.spk_warna_lain, Y.spk_tipe, Y.spk_close,
        Y.spk_close_alasan, Y.spk_reason, Y.spk_sablon, Y.spk_bordir, Y.spk_sublim,
        Y.spk_aktif, Y.spk_pinjo, Y.spk_date_last_stbj, Y.spk_label, Y.spk_pending,
        Y.spk_ketpending, Y.spk_accpending, Y.spk_cmo, Y.spk_desain, Y.spk_sudahdtf,
        Y.spk_repeat, Y.spk_tglsb, 
        DATE_FORMAT(Y.spk_tglaccproof, '%Y-%m-%d') AS spk_tglaccproof,
        Y.spk_lama, Y.spk_rev, Y.spk_rev_date, Y.spk_mpotong, Y.spk_mcetak, Y.spk_mbordir,
        Y.spk_mjahit, Y.spk_mfinishing, Y.spk_ppotong, Y.spk_pcetak, Y.spk_pbordir,
        Y.spk_pjahit, Y.spk_pfinishing, Y.spk_sizekhusus, Y.spk_mppb, Y.spk_jenis_badan,
        Y.spk_jenis_lengan, Y.spk_cabkaos, Y.spk_iscetak, Y.spk_isupdate, Y.spk_newdesign,
        Y.spk_designdone, Y.spk_new_design, Y.spk_alokasi, Y.spk_ambilstokdc, Y.spk_invdc,

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
            NULL AS lsbd_lsb_nomor, -- Di-null kan karena nomor LHK acak tidak perlu ditampilkan per baris
            lsbd_spk_nomor,
            lsbd_panjang, 
            lsbd_lebar,
            ROUND(SUM(IF(lsbd_lokasi = 'SB01', lsbd_jumlah, 0)), 0) AS sb01,
            ROUND(SUM(IF(lsbd_lokasi = 'SB02', lsbd_jumlah, 0)), 0) AS sb02,
            ROUND(SUM(IF(lsbd_lokasi = 'SB03', lsbd_jumlah, 0)), 0) AS sb03,
            ROUND(SUM(lsbd_jumlah), 0) AS lsbd_jumlah,
            -- Menggunakan MAX / MIN untuk order kuantitas agar jumlah order awal tidak ikut ter-SUM melipat ganda
            MAX(lsbd_jumlah_order) AS lsbd_jumlah_order,
            SUM(IF(lsbd_lokasi = 'SB01', lsbd_jumlah, 0) * lsbd_panjang) AS sb01_m,
            SUM(IF(lsbd_lokasi = 'SB02', lsbd_jumlah, 0) * lsbd_panjang) AS sb02_m,
            SUM(IF(lsbd_lokasi = 'SB03', lsbd_jumlah, 0) * lsbd_panjang) AS sb03_m,
            SUM(lsbd_jumlah * lsbd_panjang) AS lsbd_jumlah_m, 
            lsbd_bahan, 
            MAX(lsb_gdg_kode) AS lsb_gdg_kode,
            lsbd_poi_nomor, 
            lsbd_poid_size
        FROM (
            SELECT a.*, b.lsb_gdg_kode, b.lsb_tanggal
            FROM tlhk_sublim_dtl a
            INNER JOIN tlhk_sublim_hdr b ON (b.lsb_nomor = a.lsbd_lsb_nomor)
            WHERE b.lsb_tanggal BETWEEN ? AND ?
        ) xx
        GROUP BY lsbd_spk_nomor, lsbd_panjang, lsbd_lebar, lsbd_bahan, lsbd_poi_nomor, lsbd_poid_size
    ) X
    LEFT JOIN tspk Y ON (Y.spk_nomor = X.lsbd_spk_nomor)

    UNION ALL

    SELECT 
        X.poi_nomor, 
        DATE_FORMAT(X.poi_tanggal, '%Y-%m-%d') AS poi_tanggal, 
        DATE_FORMAT(X.poi_dateline, '%Y-%m-%d') AS poi_dateline, 
        X.poi_spk_nomor, 
        X.poid_size, 
        X.poid_jumlah,
        X.lsbd_lsb_nomor, X.lsbd_spk_nomor, X.lsbd_panjang, X.lsbd_lebar,
        X.sb01, X.sb02, X.sb03, X.lsbd_jumlah, X.lsbd_jumlah_order,
        X.sb01_m, X.sb02_m, X.sb03_m, X.lsbd_jumlah_m, X.lsbd_bahan, X.lsb_gdg_kode,
        X.lsbd_poi_nomor, X.lsbd_poid_size,
        
        -- Bagian Pemotong Datetime menjadi Date untuk tabel Y (tspk) bagian UNION bawah --
        Y.spk_nomor,
        DATE_FORMAT(Y.spk_tanggal, '%Y-%m-%d') AS spk_tanggal,
        Y.spk_cus_kode, Y.spk_cus_kaosan, Y.spk_jo_kode, Y.spk_divisi, Y.spk_nama,
        Y.spk_jumlah, Y.spk_jumlah_jadi, Y.spk_prasj, Y.spk_jumlah_kirim, Y.spk_jumlah_inv,
        Y.spk_ukuran, Y.spk_kain, Y.spk_finishing,
        DATE_FORMAT(Y.spk_dateline, '%Y-%m-%d') AS spk_dateline, 
        DATE_FORMAT(Y.spk_datelinepo, '%Y-%m-%d') AS spk_datelinepo,
        Y.spk_cab, Y.spk_workshop, Y.spk_keterangan, Y.spk_ketbeli, Y.spk_image, Y.spk_harga,
        Y.spk_status_stbj, Y.spk_status_inv, 
        DATE_FORMAT(Y.date_create, '%Y-%m-%d') AS date_create,
        Y.date_modified, Y.user_create, Y.user_modified, Y.spk_perush_kode, Y.spk_pen_nomor,
        Y.spk_pen_id, Y.spk_nama2, Y.spk_jumlah_retur, Y.spk_nomor_po, 
        DATE_FORMAT(Y.spk_tgl_po, '%Y-%m-%d') AS spk_tgl_po,
        Y.spk_ketpo, Y.spk_sal_kode, Y.spk_nomormemo, Y.spk_mspk_nomor, Y.spk_memo,
        Y.spk_closed_produksi, Y.spk_tanggal_closed, Y.spk_alasanpending, Y.spk_panjang,
        Y.spk_lebar, Y.spk_hargariil, Y.spk_hargafee, Y.spk_gramasi, Y.spk_statuskerja,
        Y.spk_warna_badan, Y.spk_warna_lengan, Y.spk_warna_lain, Y.spk_tipe, Y.spk_close,
        Y.spk_close_alasan, Y.spk_reason, Y.spk_sablon, Y.spk_bordir, Y.spk_sublim,
        Y.spk_aktif, Y.spk_pinjo, Y.spk_date_last_stbj, Y.spk_label, Y.spk_pending,
        Y.spk_ketpending, Y.spk_accpending, Y.spk_cmo, Y.spk_desain, Y.spk_sudahdtf,
        Y.spk_repeat, Y.spk_tglsb, 
        DATE_FORMAT(Y.spk_tglaccproof, '%Y-%m-%d') AS spk_tglaccproof,
        Y.spk_lama, Y.spk_rev, Y.spk_rev_date, Y.spk_mpotong, Y.spk_mcetak, Y.spk_mbordir,
        Y.spk_mjahit, Y.spk_mfinishing, Y.spk_ppotong, Y.spk_pcetak, Y.spk_pbordir,
        Y.spk_pjahit, Y.spk_pfinishing, Y.spk_sizekhusus, Y.spk_mppb, Y.spk_jenis_badan,
        Y.spk_jenis_lengan, Y.spk_cabkaos, Y.spk_iscetak, Y.spk_isupdate, Y.spk_newdesign,
        Y.spk_designdone, Y.spk_new_design, Y.spk_alokasi, Y.spk_ambilstokdc, Y.spk_invdc,

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
        SELECT a.*, b.* FROM (
            SELECT poi_nomor, poi_tanggal, poi_dateline, poi_spk_nomor, poid_size, poid_jumlah
            FROM tpointernal_hdr 
            INNER JOIN tpointernal_dtl ON (poid_nomor = poi_nomor)
            WHERE poi_sup = 'P05'
              AND poid_bhn_kode = 'LL-000400'
              AND poi_tanggal BETWEEN ? AND ?
        ) a
        LEFT JOIN (
            SELECT 
                NULL AS lsbd_lsb_nomor, 
                lsbd_spk_nomor,
                lsbd_panjang, 
                lsbd_lebar,
                ROUND(SUM(IF(lsbd_lokasi = 'SB01', lsbd_jumlah, 0)), 0) AS sb01,
                ROUND(SUM(IF(lsbd_lokasi = 'SB02', lsbd_jumlah, 0)), 0) AS sb02,
                ROUND(SUM(IF(lsbd_lokasi = 'SB03', lsbd_jumlah, 0)), 0) AS sb03,
                ROUND(SUM(lsbd_jumlah), 0) AS lsbd_jumlah,
                MAX(lsbd_jumlah_order) AS lsbd_jumlah_order,
                SUM(IF(lsbd_lokasi = 'SB01', lsbd_jumlah, 0) * lsbd_panjang) AS sb01_m,
                SUM(IF(lsbd_lokasi = 'SB02', lsbd_jumlah, 0) * lsbd_panjang) AS sb02_m,
                SUM(IF(lsbd_lokasi = 'SB03', lsbd_jumlah, 0) * lsbd_panjang) AS sb03_m,
                SUM(lsbd_jumlah * lsbd_panjang) AS lsbd_jumlah_m, 
                lsbd_bahan, 
                MAX(lsb_gdg_kode) AS lsb_gdg_kode,
                lsbd_poi_nomor, 
                lsbd_poid_size
            FROM (
                SELECT a.*, b.lsb_gdg_kode, b.lsb_tanggal
                FROM tlhk_sublim_dtl a
                INNER JOIN tlhk_sublim_hdr b ON (b.lsb_nomor = a.lsbd_lsb_nomor)
                WHERE b.lsb_tanggal BETWEEN ? AND ?
            ) xx
            GROUP BY lsbd_spk_nomor, lsbd_panjang, lsbd_lebar, lsbd_bahan, lsbd_poi_nomor, lsbd_poid_size
        ) b ON (b.lsbd_poi_nomor = a.poi_nomor AND b.lsbd_poid_size = a.poid_size)
    ) X
    LEFT JOIN tspk Y ON (Y.spk_nomor = X.poi_spk_nomor)
    
    ORDER BY spk_tanggal ASC
    LIMIT 1000
  `;

  const params = [
    tglMulai, tglSelesai, 
    tglMulai, tglSelesai, 
    tglMulai, tglSelesai  
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