// src/services/lookup.service.js

// Asumsi pool sudah didefinisikan dan terhubung dengan benar
const pool = require('../config/db.config'); 

// Fungsi Helper untuk penanganan error yang konsisten
const throwDbError = (message, error) => {
    // throw new Error(message + ': ' + error.message); 
    // Di lingkungan nyata, lempar error tanpa detail internal DB ke klien.
    throw new Error(message); 
};


/**
 * Fungsi inti untuk menjalankan query dan mengembalikan results.
 * @param {string} sql - Query SQL yang akan dijalankan.
 * @param {Array<any>} [params=[]] - Parameter untuk query (digunakan untuk mencegah SQL injection).
 * @returns {Promise<Array<Object>>} Hasil baris dari database.
 */
const executeQuery = async (sql, params = []) => {
    try {
        // NOTE: Syntax placeholder (?) digunakan di MySQL/PostgreSQL.
        // Jika Anda menggunakan driver PG murni, ganti ? dengan $1, $2, dst.
        const [rows] = await pool.query(sql, params); 
        
        // Jika menggunakan mysql2/promise, hasilnya adalah [rows, fields]. Kita kembalikan 'rows'.
        // Jika menggunakan node-postgres (pg), hasilnya adalah { rows: [...] }. Kita kembalikan 'rows.rows'.
        
        // KARENA KAMI MENGGUNAKAN [rows], KAMI ASUMSI INI ADALAH MYSQL2/PROMISE.
        return rows; 
        
    } catch (error) {
        // Tangani error database dan lempar ke controller layer
        console.error('DATABASE EXECUTION ERROR:', error.message);
        throwDbError('Gagal menjalankan query database', error);
    }
};


// -----------------------------------------------------------
// LOGIKA BUSINESS LOOKUP
// -----------------------------------------------------------


/**
 * Mengambil daftar semua gudang untuk lookup.
 */
const getGudangLookup = async () => {
    const sql = `
        SELECT gdg_kode AS Kode, gdg_nama AS Nama 
        FROM tgudang
        ORDER BY gdg_kode
    `;
    // Panggil executeQuery yang sudah terhubung ke database
    const result = await executeQuery(sql); 
    return result;
};

/**
 * Mengambil detail gudang berdasarkan kode (untuk event blur).
 * @param {string} kodeGudang
 */
const getGudangDetail = async (kodeGudang) => {
    const sql = `
        SELECT gdg_kode AS Kode, gdg_nama AS Nama 
        FROM tgudang 
        WHERE gdg_kode = ? 
    `;
    // Parameter kodeGudang dilewatkan sebagai array untuk mencegah SQL Injection
    const results = await executeQuery(sql, [kodeGudang]);
    
    // Mengembalikan objek pertama (detail tunggal)
    return results[0]; 
};


/**
 * Mengambil daftar semua mesin cetak (msn_jenis = 'C') untuk lookup.
 */
const getMesinCetakLookup = async () => {
    const sql = `
        SELECT msn_kode AS Kode, msn_nama AS Nama, msn_note AS Keterangan
        FROM tmesin_mmt
        WHERE msn_jenis = 'C'
        ORDER BY msn_kode
    `;
    const result = await executeQuery(sql);
    return result;
};


module.exports = {
    getGudangLookup,
    getGudangDetail,
    getMesinCetakLookup
};