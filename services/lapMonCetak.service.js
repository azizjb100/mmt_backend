// services/lapMonCetak.service.js
const pool = require('../config/db.config'); // Impor pool database (Asumsi pool adalah objek dari mysql2/promise)
const moment = require('moment'); 

/**
 * Menerjemahkan logika query SQL kompleks dari Delphi dan mengambil data.
 * @param {string} startDate - Tanggal mulai (YYYY-MM-DD).
 * @param {string} endDate - Tanggal akhir (YYYY-MM-DD).
 * @returns {Promise<Array>} Data laporan yang telah diproses.
 */
async function lapMonCetak(startDate, endDate) {
    // 1. Validasi dan Format Tanggal menggunakan moment
    // Digunakan untuk memastikan format yang benar sebelum dimasukkan ke parameter query
    const startDateFormat = moment(startDate).format('YYYY-MM-DD');
    const endDateFormat = moment(endDate).format('YYYY-MM-DD');

    // 2. Query SQL Kompleks (MySQL Syntax)
    // Menggunakan placeholder '?' untuk keamanan (parameterized query)
    const ssql = `
        SELECT
            spk.spk_perush_kode AS perush,
            spk.spk_tanggal AS tglSpk,
            spk.spk_dateline AS deadline,
            zz.Nama_Order AS namaOrder,
            zz.Panjang AS panjang,
            zz.Lebar AS lebar,
            spk.spk_nomor AS noSpk,
            spk.spk_jumlah AS pcs,
            (spk.spk_jumlah * spk.spk_panjang * spk.spk_lebar) AS order_meter,
            zz.Jenis_order AS jenis,
            IFNULL(zz.jml_Cetak, 0) AS jmlcetak,
            IFNULL(zz.cetak_luarx, 0) AS cetak_luar,
            spk.spk_jumlah - (IFNULL(zz.jml_Cetak, 0) + IFNULL(zz.cetak_luarx, 0)) AS jmlkurang,
            -- Kolom Qty Cetak per Mesin
            IFNULL(zz.mt01, 0) AS mt01,
            IFNULL(zz.mt02, 0) AS mt02,
            IFNULL(zz.mt03, 0) AS mt03,
            IFNULL(zz.mt04, 0) AS mt04,
            IFNULL(zz.mt05, 0) AS mt05,
            -- Kolom Volume Meter per Mesin (JMT)
            IFNULL(zz.jmt01, 0) AS jmt01,
            IFNULL(zz.jmt02, 0) AS jmt02,
            IFNULL(zz.jmt03, 0) AS jmt03,
            IFNULL(zz.jmt04, 0) AS jmt04,
            IFNULL(zz.jmt05, 0) AS jmt05,
            -- Total Qty Cetak dari semua mesin
            (IFNULL(zz.mt01,0) + IFNULL(zz.mt02,0) + IFNULL(zz.mt03,0) + IFNULL(zz.mt04,0) + IFNULL(zz.mt05,0)) AS clmtjumlah
        FROM
            tspk spk
        LEFT JOIN
        (
            -- Subquery ZZ: Menghitung jumlah cetak (Jml_Cetak) dan cetak luar (Cetak_luarx) per SPK
            -- **Perbaikan/Penyederhanaan:** Menghapus join ke tbarang_mmt dan tsupplier (u) karena tidak digunakan di SELECT akhir
            SELECT
                X.*, y.spk_tanggal, y.spk_dateline, y.spk_divisi AS Divisi, y.spk_perush_kode,
                y.spk_jo_kode AS Jenis_order, y.spk_nama AS Nama_Order, y.spk_panjang AS Panjang, y.spk_lebar AS Lebar,
                (y.spk_jumlah * y.spk_panjang * y.spk_lebar) AS jumlah_meter,
                IFNULL(h.cetak_luarx, 0) AS cetak_luarx,
                -- Kolom JMT (Volume Meter per Mesin)
                IFNULL(mt01,0) * y.spk_panjang * IF(SUBSTR(y.spk_nomor, 4, 2) = 'MX', 1, y.spk_lebar) AS jmt01,
                IFNULL(mt02,0) * y.spk_panjang * IF(SUBSTR(y.spk_nomor, 4, 2) = 'MX', 1, y.spk_lebar) AS jmt02,
                IFNULL(mt03,0) * y.spk_panjang * IF(SUBSTR(y.spk_nomor, 4, 2) = 'MX', 1, y.spk_lebar) AS jmt03,
                IFNULL(mt04,0) * y.spk_panjang * IF(SUBSTR(y.spk_nomor, 4, 2) = 'MX', 1, y.spk_lebar) AS jmt04,
                IFNULL(mt05,0) * y.spk_panjang * IF(SUBSTR(y.spk_nomor, 4, 2) = 'MX', 1, y.spk_lebar) AS jmt05
            FROM
            (
                -- Subquery X: Menghitung total cetak per mesin (mt01-mt05) dan total cetak (Jml_Cetak)
                SELECT
                    lch_tanggal AS Tanggal, lcd_brg_kode AS Bahan, lcd_spk_nomor AS Nomor_SPK,
                    SUM(lcd_qty_Cetak) AS Jml_Cetak,
                    SUM(IF(lcd_jns_mesin='MT01', lcd_qty_Cetak, 0)) AS mt01,
                    SUM(IF(lcd_jns_mesin='MT02', lcd_qty_Cetak, 0)) AS mt02,
                    SUM(IF(lcd_jns_mesin='MT03', lcd_qty_Cetak, 0)) AS mt03,
                    SUM(IF(lcd_jns_mesin='MT04', lcd_qty_Cetak, 0)) AS mt04,
                    SUM(IF(lcd_jns_mesin='MT05', lcd_qty_Cetak, 0)) AS mt05
                FROM tlhk_cetakmmt_dtl a
                INNER JOIN tlhk_cetakmmt_hdr b ON (b.lch_nomor = a.lcd_lch_nomor)
                WHERE lch_tanggal BETWEEN ? AND ? -- Filter 1: Tanggal LHK
                GROUP BY lcd_spk_nomor
            ) X
            LEFT JOIN
            (
                -- Subquery Y: Menggabungkan data SPK dari tspk dan tmemospk
                SELECT spk_perush_kode, spk_nomor, spk_nama, spk_jumlah, spk_panjang, spk_lebar, spk_jo_kode, spk_divisi, spk_tanggal, spk_dateline
                FROM tspk
                UNION ALL
                SELECT mspk_perush_kode, mspk_nomor, mspk_nama, mspk_jumlah, mspk_panjang, mspk_lebar, mspk_jo_kode, mspk_divisi, mspk_tanggal, mspk_dateline
                FROM tmemospk
            ) y ON y.spk_nomor = X.Nomor_SPK
            -- LEFT JOIN ke tbarang_mmt dan tsupplier (u) telah DIHAPUS
            LEFT JOIN
            (
                -- Subquery H: Menghitung total cetak luar per SPK
                SELECT poe_spk_nomor AS poe_Spk, SUM(IFNULL(poe_jumlah,0)) AS cetak_luarx
                FROM tpoexternal_hdr
                WHERE poe_cab='P05'
                GROUP BY 1
            ) h ON h.poe_spk = X.Nomor_SPK
            GROUP BY X.Nomor_SPK
        ) zz ON zz.Nomor_SPK = spk.spk_nomor
        WHERE
            spk.spk_tanggal BETWEEN ? AND ? -- Filter 2: Tanggal SPK
            AND spk_aktif = 'Y'
            AND spk.spk_divisi = 5
            AND SUBSTR(spk_nomor, 4, 2) = 'MT'
        ORDER BY
            spk.spk_tanggal ASC, spk.spk_nomor ASC;
    `;

    try {
        // 3. Susunan Parameter untuk Query
        const params = [
            startDateFormat, 
            endDateFormat, // Untuk Filter 1 (Tanggal LHK)
            startDateFormat, 
            endDateFormat  // Untuk Filter 2 (Tanggal SPK)
        ];
        
        // 4. Eksekusi Query Database
        // PERBAIKAN: Menggunakan pool.execute() jika Anda menggunakan mysql2/promise
        const [reportData] = await pool.execute(ssql, params);
        
        return reportData;

    } catch (error) {
        // Log error yang lebih detail, termasuk nilai parameter
        console.error("Kesalahan saat menjalankan query laporan monitoring cetak:", error);
        console.error("Parameter yang digunakan:", startDateFormat, endDateFormat);
        throw new Error('Gagal memuat data laporan dari database.');
    }
}

module.exports = {
    lapMonCetak, 
};