// backend/src/services/spk.service.js

const pool = require('../config/db.config'); 
const throwDbError = (message, error) => { throw new Error(message + ': ' + error.message); };

/**
 * Helper untuk membangun query gabungan TSPK dan TMEMOSPK
 * Menggunakan UNION agar data dari kedua tabel muncul dalam satu daftar.
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
            t.spk_panjang AS Panjang, 
            t.spk_lebar AS Lebar, 
            t.spk_jumlah_jadi AS Jumlah_jadi,
            'REGULER' as Tipe_SPK
        FROM v_help_spk v
        INNER JOIN tspk t ON t.spk_nomor = v.Spk
        WHERE ${whereClause}

        UNION ALL

        SELECT 
            m.mspk_nomor AS SPK, 
            m.mspk_nama AS Nama, 
            '5' AS Divisi, 
            m.mspk_tanggal AS Tanggal, 
            m.mspk_jumlah AS Jumlah,
            m.mspk_ukuran AS Ukuran, 
            '' AS Bahan,            /* Solusi: Gunakan string kosong karena kolom tidak ada */
            m.mspk_gramasi AS Gramasi,
            m.mspk_panjang AS Panjang, 
            m.mspk_lebar AS Lebar, 
            m.mspk_jumlah AS Jumlah_jadi,
            'MEMO' as Tipe_SPK
        FROM tmemospk m
        WHERE m.mspk_divisi = '5'
    `;
};

// ===================================
// 1. READ SPK LOOKUP DATA
// ===================================

exports.getSpkLookupData = async (keyword) => {
    try {
        // Kita bungkus UNION di dalam subquery agar filter WHERE keyword dan ORDER BY bekerja global
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
        throwDbError('Gagal mengambil data SPK (Reguler/Memo) untuk lookup', error);
    }
};

// ===================================
// 2. READ SPK DETAIL BY NOMOR
// ===================================

exports.getSpkDetailByNomor = async (nomor) => {
    try {
        // Mencari di hasil gabungan berdasarkan nomor spesifik
        const sql = `
            SELECT * FROM (
                ${getBaseSpkQuery()}
            ) AS combined_spk
            WHERE SPK = ?
        `;
        
        const [rows] = await pool.query(sql, [nomor]);
        
        if (rows.length === 0) {
            throw new Error(`Nomor SPK/Memo ${nomor} tidak ditemukan.`);
        }
        
        return rows[0]; 

    } catch (error) {
        throwDbError(`Gagal memuat detail SPK/Memo dengan nomor ${nomor}`, error);
    }
};