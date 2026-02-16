// backend/src/services/spk.service.js

const pool = require('../config/db.config'); 
const throwDbError = (message, error) => { throw new Error(message + ': ' + error.message); };

/**
 * Helper untuk membangun query gabungan TSPK dan TMEMOSPK dengan Akumulasi Produksi.
 * Kolom Sudah_Cetak mengambil data dari realisasi LHK yang sudah ada di detail mesin.
 */
const getBaseSpkQuery = (whereClause = "v.divisi = '5'") => {
    return `
        SELECT 
            v.Spk AS SPK, 
            v.Nama AS Nama, 
            v.divisi AS Divisi, 
            v.Tanggal AS Tanggal, 
            v.Jumlah AS Jumlah,
            t.spk_ukuran AS Ukuran, 
            t.spk_kain AS Bahan, 
            t.spk_gramasi AS Gramasi,
            IFNULL(t.spk_panjang, 0) AS Panjang, 
            IFNULL(t.spk_lebar, 0) AS Lebar,
            -- Akumulasi Produksi dari LHK Mesin
            CAST(IFNULL(prod.total_pernah_cetak, 0) AS UNSIGNED) AS Sudah_Cetak,
            -- Sisa yang belum diproduksi
            CAST(GREATEST(0, v.Jumlah - IFNULL(prod.total_pernah_cetak, 0)) AS UNSIGNED) AS Kurang_Cetak,
            'REGULER' as Tipe_SPK
        FROM v_help_spk v
        INNER JOIN tspk t ON t.spk_nomor = v.Spk
        LEFT JOIN (
            SELECT ld_spk_nomor, SUM(ld_total_qtycetak) as total_pernah_cetak
            FROM tlhk_mesin_dtl
            GROUP BY ld_spk_nomor
        ) prod ON prod.ld_spk_nomor = v.Spk
        WHERE ${whereClause}

        UNION ALL

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
    `;
};

// ===================================
// 1. READ SPK LOOKUP DATA (Untuk Modal Bantuan)
// ===================================
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
// 2. READ SPK DETAIL BY NOMOR
// ===================================
exports.getSpkDetailByNomor = async (nomor) => {
    try {
        const sql = `
            SELECT * FROM (
                ${getBaseSpkQuery("1=1")} 
            ) AS combined_spk
            WHERE SPK = ?
        `;
        // Note: Gunakan "1=1" agar filter divisi di helper tidak membatasi pencarian detail jika nomor sudah spesifik
        
        const [rows] = await pool.query(sql, [nomor]);
        
        if (rows.length === 0) {
            throw new Error(`Nomor SPK/Memo ${nomor} tidak ditemukan.`);
        }
        
        return rows[0]; 

    } catch (error) {
        throwDbError(`Gagal memuat detail SPK/Memo dengan nomor ${nomor}`, error);
    }
};