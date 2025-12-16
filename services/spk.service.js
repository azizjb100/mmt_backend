// backend/src/services/spk.service.js

const pool = require('../config/db.config'); 
const throwDbError = (message, error) => { throw new Error(message + ': ' + error.message); };

// ===================================
// 1. READ SPK LOOKUP DATA (Sesuai dengan v_help_spk di Delphi)
// ===================================

/**
 * Mengambil data SPK untuk ditampilkan di modal lookup (Bantuan).
 * Replikasi SQL dari ufrmmintabahan_mmt.clSPKPropertiesButtonClick.
 * @param {string} keyword - Kata kunci untuk pencarian (opsional)
 */
exports.getSpkLookupData = async (keyword) => {
    try {
        // SQL Bantuan di Delphi: 'SELECT * FROM v_help_spk WHERE divisi=5'
        let sql = `
            SELECT 
        v.Spk AS SPK,
        v.Nama AS Nama,
        v.divisi AS Divisi,
        v.Tanggal AS Tanggal,
        t.spk_ukuran AS Ukuran,
        t.spk_kain AS Bahan,
        t.spk_gramasi AS Gramasi,
        t.spk_panjang AS Panjang,
        t.spk_lebar AS Lebar,
        v.Jumlah AS Jumlah,
        t.spk_jumlah_jadi AS Jumlah_jadi
      FROM v_help_spk v
      LEFT JOIN tspk t 
          ON t.spk_nomor = v.Spk
      WHERE v.divisi = '5'
        `; 

        const params = [];
        
        // Logika filter (sqlfilter: 'spk,Nama')
        if (keyword) {
            sql += ` AND (Spk LIKE ? OR Nama LIKE ?)`;
            const searchKeyword = `%${keyword}%`;
            params.push(searchKeyword, searchKeyword);
        }

        sql += ` ORDER BY Spk DESC`;
        
        const [rows] = await pool.query(sql, params);
        
        // Hasil ini akan digunakan untuk mengisi tabel di modal bantuan.
        // Frontend akan mengambil varglobal (spk_nomor) dan varglobal1 (spk_nama)
        return rows; 

    } catch (error) {
        throwDbError('Gagal mengambil data SPK untuk lookup', error);
    }
};

// ===================================
// 2. READ SPK DETAIL BY NOMOR (Opsional, jika dibutuhkan detail lebih lanjut)
// ===================================

/**
 * Mengambil detail SPK berdasarkan nomor SPK.
 * Di Delphi, detail hanya diambil dari hasil lookup, tapi fungsi ini berguna jika 
 * diperlukan validasi/detail di backend.
 * @param {string} nomor - Nomor SPK
 */
exports.getSpkDetailByNomor = async (nomor) => {
    try {
        const sql = `
            SELECT 
                v.Spk AS SPK,
        v.Nama AS Nama,
        v.divisi AS Divisi,
        v.Tanggal AS Tanggal,
                -- Ambil semua kolom yang diperlukan
            FROM v_help_spk v
            WHERE SPK = ? AND Divisi = 5;
        `;
        
        const [rows] = await pool.query(sql, [nomor]);
        
        if (rows.length === 0) {
            throw new Error(`Nomor SPK ${nomor} tidak ditemukan atau tidak valid.`);
        }
        
        return rows[0]; 

    } catch (error) {
        throwDbError(`Gagal memuat detail SPK dengan nomor ${nomor}`, error);
    }
};