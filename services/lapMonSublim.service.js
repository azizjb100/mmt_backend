const pool = require('../config/db.config');
const moment = require('moment');

/**
 * Service untuk menarik data Laporan Monitoring Sublim - Fix Akumulasi Tanpa Double
 * Disinkronkan dari logika Delphi 7 ufrmLapMon_Sublim (loaddata)
 * @param {string} startDate - Format 'YYYY-MM-DD'
 * @param {string} endDate - Format 'YYYY-MM-DD'
 */
const lapMonSublim = async (startDate, endDate) => {
  const tglMulai = moment(startDate).format('YYYY-MM-DD');
  const tglSelesai = moment(endDate).format('YYYY-MM-DD');

  // SOLUSI UTAMA: Membungkus UNION ALL milik Delphi ke dalam subquery outer (U),
  // lalu melakukan GROUP BY berdasarkan SPK, Ukuran, Panjang, dan Lebar secara mutlak.
  const ssql = `
    SELECT 
        MAX(U.poi_nomor) AS poi_nomor,
        MAX(U.poi_tanggal) AS poi_tanggal,
        MAX(U.poi_dateline) AS poi_dateline,
        MAX(U.poi_spk_nomor) AS poi_spk_nomor,
        U.poid_size,
        SUM(U.poid_jumlah) AS poid_jumlah,
        
        MAX(U.lsbd_lsb_nomor) AS lsbd_lsb_nomor,
        U.lsbd_spk_nomor,
        U.lsbd_panjang,
        U.lsbd_lebar,
        
        SUM(U.sb01) AS sb01,
        SUM(U.sb02) AS sb02,
        SUM(U.sb03) AS sb03,
        SUM(U.lsbd_jumlah) AS lsbd_jumlah,
        MAX(U.lsbd_jumlah_order) AS lsbd_jumlah_order,
        
        SUM(U.sb01_m) AS sb01_m,
        SUM(U.sb02_m) AS sb02_m,
        SUM(U.sb03_m) AS sb03_m,
        SUM(U.lsbd_jumlah_m) AS lsbd_jumlah_m,
        MAX(U.lsbd_bahan) AS lsbd_bahan,
        MAX(U.lsb_gdg_kode) AS lsb_gdg_kode,
        MAX(U.lsbd_poi_nomor) AS lsbd_poi_nomor,
        MAX(U.lsbd_poid_size) AS lsbd_poid_size,
        
        U.spk_nomor,
        MAX(U.spk_tanggal) AS spk_tanggal,
        MAX(U.spk_cus_kode) AS spk_cus_kode, 
        MAX(U.spk_cus_kaosan) AS spk_cus_kaosan, 
        MAX(U.spk_jo_kode) AS spk_jo_kode, 
        MAX(U.spk_divisi) AS spk_divisi, 
        MAX(U.spk_nama) AS spk_nama,
        MAX(U.spk_jumlah) AS spk_jumlah, 
        MAX(U.spk_jumlah_jadi) AS spk_jumlah_jadi, 
        MAX(U.spk_prasj) AS spk_prasj, 
        MAX(U.spk_jumlah_kirim) AS spk_jumlah_kirim, 
        MAX(U.spk_jumlah_inv) AS spk_jumlah_inv,
        MAX(U.spk_ukuran) AS spk_ukuran, 
        MAX(U.spk_kain) AS spk_kain, 
        MAX(U.spk_finishing) AS spk_finishing,
        MAX(U.spk_dateline) AS spk_dateline,
        MAX(U.spk_datelinepo) AS spk_datelinepo,
        MAX(U.spk_cab) AS spk_cab, 
        MAX(U.spk_workshop) AS spk_workshop, 
        MAX(U.spk_keterangan) AS spk_keterangan, 
        MAX(U.spk_ketbeli) AS spk_ketbeli, 
        MAX(U.spk_image) AS spk_image, 
        MAX(U.spk_harga) AS spk_harga,
        MAX(U.spk_status_stbj) AS spk_status_stbj, 
        MAX(U.spk_status_inv) AS spk_status_inv,
        MAX(U.date_create) AS date_create,
        MAX(U.date_modified) AS date_modified, 
        MAX(U.user_create) AS user_create, 
        MAX(U.user_modified) AS user_modified, 
        MAX(U.spk_perush_kode) AS spk_perush_kode, 
        MAX(U.spk_pen_nomor) AS spk_pen_nomor,
        MAX(U.spk_pen_id) AS spk_pen_id, 
        MAX(U.spk_nama2) AS spk_nama2, 
        MAX(U.spk_jumlah_retur) AS spk_jumlah_retur, 
        MAX(U.spk_nomor_po) AS spk_nomor_po,
        MAX(U.spk_tgl_po) AS spk_tgl_po,
        MAX(U.spk_ketpo) AS spk_ketpo, 
        MAX(U.spk_sal_kode) AS spk_sal_kode, 
        MAX(U.spk_nomormemo) AS spk_nomormemo, 
        MAX(U.spk_mspk_nomor) AS spk_mspk_nomor, 
        MAX(U.spk_memo) AS spk_memo,
        MAX(U.spk_closed_produksi) AS spk_closed_produksi, 
        MAX(U.spk_tanggal_closed) AS spk_tanggal_closed, 
        MAX(U.spk_alasanpending) AS spk_alasanpending, 
        MAX(U.spk_panjang) AS spk_panjang,
        MAX(U.spk_lebar) AS spk_lebar, 
        MAX(U.spk_hargariil) AS spk_hargariil, 
        MAX(U.spk_hargafee) AS spk_hargafee, 
        MAX(U.spk_gramasi) AS spk_gramasi, 
        MAX(U.spk_statuskerja) AS spk_statuskerja,
        MAX(U.spk_warna_badan) AS spk_warna_badan, 
        MAX(U.spk_warna_lengan) AS spk_warna_lengan, 
        MAX(U.spk_warna_lain) AS spk_warna_lain, 
        MAX(U.spk_tipe) AS spk_tipe, 
        MAX(U.spk_close) AS spk_close,
        MAX(U.spk_close_alasan) AS spk_close_alasan, 
        MAX(U.spk_reason) AS spk_reason, 
        MAX(U.spk_sablon) AS spk_sablon, 
        MAX(U.spk_bordir) AS spk_bordir, 
        MAX(U.spk_sublim) AS spk_sublim,
        MAX(U.spk_aktif) AS spk_aktif, 
        MAX(U.spk_pinjo) AS spk_pinjo, 
        MAX(U.spk_date_last_stbj) AS spk_date_last_stbj, 
        MAX(U.spk_label) AS spk_label, 
        MAX(U.spk_pending) AS spk_pending,
        MAX(U.spk_ketpending) AS spk_ketpending, 
        MAX(U.spk_accpending) AS spk_accpending, 
        MAX(U.spk_cmo) AS spk_cmo, 
        MAX(U.spk_desain) AS spk_desain, 
        MAX(U.spk_sudahdtf) AS spk_sudahdtf,
        MAX(U.spk_repeat) AS spk_repeat, 
        MAX(U.spk_tglsb) AS spk_tglsb,
        MAX(U.spk_tglaccproof) AS spk_tglaccproof,
        MAX(U.spk_lama) AS spk_lama, 
        MAX(U.spk_rev) AS spk_rev, 
        MAX(U.spk_rev_date) AS spk_rev_date, 
        MAX(U.spk_mpotong) AS spk_mpotong, 
        MAX(U.spk_mcetak) AS spk_mcetak, 
        MAX(U.spk_mbordir) AS spk_mbordir,
        MAX(U.spk_mjahit) AS spk_mjahit, 
        MAX(U.spk_mfinishing) AS spk_mfinishing, 
        MAX(U.spk_ppotong) AS spk_ppotong, 
        MAX(U.spk_pcetak) AS spk_pcetak, 
        MAX(U.spk_pbordir) AS spk_pbordir,
        MAX(U.spk_pjahit) AS spk_pjahit, 
        MAX(U.spk_pfinishing) AS spk_pfinishing, 
        MAX(U.spk_sizekhusus) AS spk_sizekhusus, 
        MAX(U.spk_mppb) AS spk_mppb, 
        MAX(U.spk_jenis_badan) AS spk_jenis_badan,
        MAX(U.spk_jenis_lengan) AS spk_jenis_lengan, 
        MAX(U.spk_cabkaos) AS spk_cabkaos, 
        MAX(U.spk_iscetak) AS spk_iscetak, 
        MAX(U.spk_isupdate) AS spk_isupdate, 
        MAX(U.spk_newdesign) AS spk_newdesign,
        MAX(U.spk_designdone) AS spk_designdone, 
        MAX(U.spk_new_design) AS spk_new_design, 
        MAX(U.spk_alokasi) AS spk_alokasi, 
        MAX(U.spk_ambilstokdc) AS spk_ambilstokdc, 
        MAX(U.spk_invdc) AS spk_invdc,

        SUM(U.meter_order) AS meter_order,
        SUM(U.kurang) AS kurang,
        SUM(U.sb01_std) AS sb01_std,
        SUM(U.sb02_std) AS sb02_std,
        SUM(U.sb03_std) AS sb03_std,
        SUM(U.pcs_std) AS pcs_std,
        SUM(U.sb01_std_m) AS sb01_std_m,
        SUM(U.sb02_std_m) AS sb02_std_m,
        SUM(U.sb03_std_m) AS sb03_std_m,
        SUM(U.meter_std) AS meter_std
    FROM (
        -- ================== BLOK DATA 1 (Murni Realisasi LHK Sublim) ==================
        SELECT 
            NULL AS poi_nomor, 
            NULL AS poi_tanggal, 
            NULL AS poi_dateline, 
            NULL AS poi_spk_nomor, 
            X.lsbd_poid_size AS poid_size, 
            0 AS poid_jumlah,
            X.lsbd_lsb_nomor, X.lsbd_spk_nomor, X.lsbd_panjang, X.lsbd_lebar,
            X.sb01, X.sb02, X.sb03, X.lsbd_jumlah, X.lsbd_jumlah_order,
            X.sb01_m, X.sb02_m, X.sb03_m, X.lsbd_jumlah_m, X.lsbd_bahan, X.lsb_gdg_kode,
            X.lsbd_poi_nomor, X.lsbd_poid_size,
            
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
                NULL AS lsbd_lsb_nomor, -- Di-null kan agar nomor dokumen internal LHK tidak memecah baris
                lsbd_spk_nomor, lsbd_panjang, lsbd_lebar,
                ROUND(SUM(IF(lsbd_lokasi = 'SB01', lsbd_jumlah, 0)), 0) AS sb01,
                ROUND(SUM(IF(lsbd_lokasi = 'SB02', lsbd_jumlah, 0)), 0) AS sb02,
                ROUND(SUM(IF(lsbd_lokasi = 'SB03', lsbd_jumlah, 0)), 0) AS sb03,
                ROUND(SUM(lsbd_jumlah), 0) AS lsbd_jumlah,
                MAX(lsbd_jumlah_order) AS lsbd_jumlah_order,
                SUM(IF(lsbd_lokasi = 'SB01', lsbd_jumlah, 0) * lsbd_panjang) AS sb01_m,
                SUM(IF(lsbd_lokasi = 'SB02', lsbd_jumlah, 0) * lsbd_panjang) AS sb02_m,
                SUM(IF(lsbd_lokasi = 'SB03', lsbd_jumlah, 0) * lsbd_panjang) AS sb03_m,
                SUM(lsbd_jumlah * lsbd_panjang) AS lsbd_jumlah_m, 
                lsbd_bahan, MAX(lsb_gdg_kode) AS lsb_gdg_kode, lsbd_poi_nomor, lsbd_poid_size
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

        -- ================== BLOK DATA 2 (Sinkronisasi PO Internal Supplier Kaos) ==================
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
                    lsbd_spk_nomor, lsbd_panjang, lsbd_lebar,
                    ROUND(SUM(IF(lsbd_lokasi = 'SB01', lsbd_jumlah, 0)), 0) AS sb01,
                    ROUND(SUM(IF(lsbd_lokasi = 'SB02', lsbd_jumlah, 0)), 0) AS sb02,
                    ROUND(SUM(IF(lsbd_lokasi = 'SB03', lsbd_jumlah, 0)), 0) AS sb03,
                    ROUND(SUM(lsbd_jumlah), 0) AS lsbd_jumlah,
                    MAX(lsbd_jumlah_order) AS lsbd_jumlah_order,
                    SUM(IF(lsbd_lokasi = 'SB01', lsbd_jumlah, 0) * lsbd_panjang) AS sb01_m,
                    SUM(IF(lsbd_lokasi = 'SB02', lsbd_jumlah, 0) * lsbd_panjang) AS sb02_m,
                    SUM(IF(lsbd_lokasi = 'SB03', lsbd_jumlah, 0) * lsbd_panjang) AS sb03_m,
                    SUM(lsbd_jumlah * lsbd_panjang) AS lsbd_jumlah_m, 
                    lsbd_bahan, MAX(lsb_gdg_kode) AS lsb_gdg_kode, lsbd_poi_nomor, lsbd_poid_size
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
    ) U
    WHERE U.spk_nomor IS NOT NULL
    GROUP BY U.spk_nomor, U.poid_size, U.lsbd_panjang, U.lsbd_lebar
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