// backend/src/services/spk.service.js

const pool = require('../config/db.config'); 
const { format } = require('date-fns');

const throwDbError = (message, error) => { throw new Error(message + ': ' + error.message); };

/**
 * Logika Utama: Menggabungkan TSPK, TMEMOSPK, dan Kalkulasi Produksi
 * Diperbaiki agar menyertakan status 'Ngedit' (PIN), Approval, dan Akumulasi 
 */
const getBaseSpkQuery = (whereClause = "1=1") => {
    return `
        SELECT x.*,
            /* Logika Warna/Status PIN (Ngedit) untuk Frontend */
            IFNULL(
                IF(x.ppin='N', 'TOLAK',
                    IF(x.ppin='Y' AND x.ppakai='', 'ACC',
                        IF(x.ppin='Y' AND x.ppakai='Y', '', 
                            IF(x.ppin='WAIT', 'WAIT', '')
                        )
                    )
                ), ''
            ) AS Ngedit
        FROM (
            /* --- SECTION 1: SPK REGULER --- */
            SELECT 
                t.spk_nomor AS SPK, 
                t.spk_nama AS Nama, 
                v.divisi AS Divisi, 
                t.spk_tanggal AS Tanggal, 
                t.spk_jumlah AS Jumlah,
                t.spk_ukuran AS Ukuran, 
                t.spk_kain AS Bahan, 
                t.spk_gramasi AS Gramasi,
                IFNULL(t.spk_panjang, 0) AS Panjang, 
                IFNULL(t.spk_lebar, 0) AS Lebar,
                t.spk_statuskerja AS Kepentingan,
                t.spk_cmo AS CMO,
                IF(t.spk_close=1, 'Closed', 'Open') AS STATUS,
                t.spk_aktif AS Aktif,
                t.spk_pending AS Pending,
                t.spk_accpending AS AccPending,
                t.spk_newdesign AS design_baru,
                t.spk_designdone AS design_done,

                /* PIN System (Logika Ngedit) */
                IFNULL((SELECT pin_acc FROM tspk_pin5 WHERE pin_trs="SPK" AND pin_nomor=t.spk_nomor ORDER BY pin_urut DESC LIMIT 1), "NULL") as ppin,
                IFNULL((SELECT pin_dipakai FROM tspk_pin5 WHERE pin_trs="SPK" AND pin_nomor=t.spk_nomor ORDER BY pin_urut DESC LIMIT 1), "NULL") as ppakai,

                /* Akumulasi Produksi (Sudah Cetak) */
                CAST(IFNULL(prod.total_pernah_cetak, 0) AS UNSIGNED) AS Sudah_Cetak,
                CAST(GREATEST(0, t.spk_jumlah - IFNULL(prod.total_pernah_cetak, 0)) AS UNSIGNED) AS Kurang_Cetak,
                'REGULER' as Tipe_SPK
            FROM tspk t
            LEFT JOIN v_help_spk v ON v.Spk = t.spk_nomor
            LEFT JOIN (
                SELECT ld_spk_nomor, SUM(ld_total_qtycetak) as total_pernah_cetak
                FROM tlhk_mesin_dtl
                GROUP BY ld_spk_nomor
            ) prod ON prod.ld_spk_nomor = t.spk_nomor
            WHERE ${whereClause}

            UNION ALL

            /* --- SECTION 2: MEMO SPK --- */
            SELECT 
                m.mspk_nomor AS SPK, 
                m.mspk_nama AS Nama, 
                '5' AS Divisi, 
                m.mspk_tanggal AS Tanggal, 
                m.mspk_jumlah AS Jumlah,
                m.mspk_ukuran AS Ukuran, 
                '' AS Bahan,
                m.mspk_gramasi AS Gramasi,
                IFNULL(m.mspk_panjang, 0) AS Panjang, 
                IFNULL(m.mspk_lebar, 0) AS Lebar,
                'INTERNAL' AS Kepentingan,
                '' AS CMO,
                'Open' AS STATUS,
                'Y' AS Aktif,
                'NORMAL' AS Pending,
                'ACC' AS AccPending,
                'N' AS design_baru,
                'Y' AS design_done,
                'NULL' as ppin,
                'NULL' as ppakai,
                CAST(IFNULL(prod_m.total_pernah_cetak, 0) AS UNSIGNED) AS Sudah_Cetak,
                CAST(GREATEST(0, m.mspk_jumlah - IFNULL(prod_m.total_pernah_cetak, 0)) AS UNSIGNED) AS Kurang_Cetak,
                'MEMO' as Tipe_SPK
            FROM tmemospk m
            LEFT JOIN (
                SELECT ld_spk_nomor, SUM(ld_total_qtycetak) as total_pernah_cetak
                FROM tlhk_mesin_dtl
                GROUP BY ld_spk_nomor
            ) prod_m ON prod_m.ld_spk_nomor = m.mspk_nomor
            WHERE m.mspk_divisi = '5'
        ) x
    `;
};

/**
 * Logika Utama: Mengambil data STBJ dengan agregat jumlah item per transaksi
 */
/**
 * Logika Utama: Mengambil data STBJ dengan join ke gudang atau checker jika diperlukan
 */
const getBaseStbjQuery = (whereClause = "1=1") => {
    return `
        SELECT 
            h.stbj_nomor AS Nomor,
            h.stbj_tanggal AS Tanggal,
            h.stbj_keterangan AS Keterangan,
            h.stbj_gdg_kode AS Gudang_Asal,
            h.stbj_gdgp_kode AS Gudang_Tujuan,
            h.stbj_checker AS Checker,
            h.stbj_ts_nomor AS No_TS,
            /* Menghitung akumulasi Qty dan Koli dari detail */
            IFNULL(dtl.total_qty, 0) AS Total_Qty,
            IFNULL(dtl.total_koli, 0) AS Total_Koli
        FROM tstbj_hdr h
        LEFT JOIN (
            SELECT 
                stbjd_stbj_nomor, 
                SUM(stbjd_jumlah) as total_qty, 
                SUM(stbjd_koli) as total_koli 
            FROM tstbj_dtl 
            GROUP BY stbjd_stbj_nomor
        ) dtl ON h.stbj_nomor = dtl.stbjd_stbj_nomor
        WHERE ${whereClause}
    `;
};


// ===================================
// LOOKUP STBJ (Untuk Modal Pencarian)
// ===================================
exports.getStbjLookupData = async (keyword) => {
    try {
        let sql = `SELECT * FROM (${getBaseStbjQuery()}) AS stbj_combined`;
        const params = [];

        if (keyword) {
            // Mencari berdasarkan nomor STBJ, Keterangan, atau Nomor TS
            sql += ` WHERE (Nomor LIKE ? OR Keterangan LIKE ? OR No_TS LIKE ?)`;
            const searchKeyword = `%${keyword}%`;
            params.push(searchKeyword, searchKeyword, searchKeyword);
        }

        sql += ` ORDER BY Tanggal DESC LIMIT 50`;
        
        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data lookup STBJ', error);
    }
};

// ===================================
// DETAIL STBJ (Header & Rincian Item)
// ===================================
exports.getStbjFullDetail = async (nomorStbj) => {
    try {
        // 1. Ambil Data Header
        const [header] = await pool.query(getBaseStbjQuery("h.stbj_nomor = ?"), [nomorStbj]);
        if (header.length === 0) throw new Error(`STBJ ${nomorStbj} tidak ditemukan.`);

        // 2. Ambil Data Detail sesuai struktur gambar (stbjd_...)
        const sqlItems = `
            SELECT 
                d.stbjd_spk_nomor AS No_SPK,
                s.spk_nama AS Nama_SPK,
                d.stbjd_size AS Size,
                d.stbjd_jumlah AS Qty,
                d.stbjd_koli AS Koli,
                d.stbjd_packing AS Packing,
                d.stbjd_keterangan AS Catatan
            FROM tstbj_dtl d
            LEFT JOIN tspk s ON d.stbjd_spk_nomor = s.spk_nomor
            WHERE d.stbjd_stbj_nomor = ?
            ORDER BY d.stbjd_spk_nomor ASC
        `;
        const [items] = await pool.query(sqlItems, [nomorStbj]);

        return {
            ...header[0],
            items: items
        };
    } catch (error) {
        throwDbError(`Gagal memuat detail STBJ ${nomorStbj}`, error);
    }
};

exports.getSpkLookupData = async (keyword) => {
    try {
        let sql = `
            SELECT * FROM (
                ${getBaseSpkQuery()}
            ) AS combined_spk
        `; 

        const params = [];
        if (keyword) {
            sql += ` WHERE (SPK LIKE ? OR Nama LIKE ?)`;
            const searchKeyword = `%${keyword}%`;
            params.push(searchKeyword, searchKeyword);
        }

        sql += ` ORDER BY Tanggal DESC LIMIT 50`;
        
        const [rows] = await pool.query(sql, params);
        return rows; 

    } catch (error) {
        throwDbError('Gagal mengambil data SPK untuk lookup', error);
    }
};

// ===================================
// 1. BROWSE DATA (UTAMA) - Pengganti btnRefreshClick
// ===================================
exports.getAllSpkData = async (filters) => {
    try {
        const { startDate, endDate, keyword, cabang } = filters;
        
        let where = "1=1";
        const params = [];

        if (startDate && endDate) {
            where += ` AND t.spk_tanggal BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        if (cabang && cabang !== 'ALL') {
            where += ` AND t.spk_cab = ?`;
            params.push(cabang);
        }

        let sql = getBaseSpkQuery(where);

        if (keyword) {
            sql = `SELECT * FROM (${sql}) as sub WHERE SPK LIKE ? OR Nama LIKE ?`;
            params.push(`%${keyword}%`, `%${keyword}%`);
        }

        sql += ` ORDER BY Tanggal DESC`;

        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data Browse SPK', error);
    }
};

// ===================================
// 2. DETAIL SIZE (Expanded Row Logic)
// ===================================
exports.getSpkDetailSize = async (nomor) => {
    try {
        const sql = `
            SELECT 
                z.spks_nomor AS Nomor, 
                z.spks_size AS Size, 
                z.spks_qty AS Qty,
                IFNULL((SELECT SUM(d.stbjd_jumlah) FROM tstbj_dtl d 
                        WHERE d.stbjd_spk_nomor=z.spks_nomor AND d.stbjd_size=z.spks_size), 0) AS Stbj,
                (z.spks_qty - IFNULL((SELECT SUM(d.stbjd_jumlah) FROM tstbj_dtl d 
                                      WHERE d.stbjd_spk_nomor=z.spks_nomor AND d.stbjd_size=z.spks_size), 0)) AS Kurang
            FROM tspk_size z
            WHERE z.spks_nomor = ?
        `;
        const [rows] = await pool.query(sql, [nomor]);
        return rows;
    } catch (error) {
        throwDbError('Gagal memuat detail size', error);
    }
};

// ===================================
// 3. DETAIL UNTUK PRINT / EDIT
// ===================================
exports.getSpkDetailByNomor = async (nomor) => {
    try {
        const sql = `SELECT * FROM (${getBaseSpkQuery("t.spk_nomor = ?")}) AS combined_spk`;
        const [rows] = await pool.query(sql, [nomor]);
        
        if (rows.length === 0) throw new Error(`Nomor SPK ${nomor} tidak ditemukan.`);
        return rows[0]; 
    } catch (error) {
        throwDbError(`Gagal memuat detail SPK ${nomor}`, error);
    }
};

exports.getSpkForPrint = async (nomor) => {
    try {
        // 1. Ambil Header (Gunakan fungsi yang sudah ada)
        const header = await this.getSpkDetailByNomor(nomor);

        // 2. Ambil Detail Size
        const details = await this.getSpkDetailSize(nomor);

        // 3. Gabungkan
        return {
            ...header,
            details: details
        };
    } catch (error) {
        throwDbError(`Gagal memproses data cetak SPK ${nomor}`, error);
    }
};