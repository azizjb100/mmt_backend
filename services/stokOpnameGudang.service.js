// backend/src/services/stokOpname.service.js

const pool = require('../config/db.config');
const { format } = require('date-fns');

// Helper untuk throw error
const throwDbError = (message, error) => { throw new Error(message + ': ' + error.message); };

// ===================================
// 1. GET NEW NOMOR (Generate Session ID)
// ===================================
exports.getNewSessionID = async () => {
    const NOMERATOR = 'OPN.MMT';
    try {
        const currentYYMM = format(new Date(), 'yyMM');
        const searchPattern = `${NOMERATOR}.${currentYYMM}.%`;

        const sql = `
            SELECT MAX(opn_session_id) AS MaxNomor 
            FROM topname_mmt 
            WHERE opn_session_id LIKE ?;
        `;

        const [results] = await pool.query(sql, [searchPattern]);
        const maxNomor = results[0].MaxNomor;

        let newNumber = '0001';
        if (maxNomor) {
            const lastNumberString = maxNomor.substring(maxNomor.lastIndexOf('.') + 1);
            const lastNumber = parseInt(lastNumberString, 10);
            newNumber = (lastNumber + 1).toString().padStart(4, '0');
        }
        return `${NOMERATOR}.${currentYYMM}.${newNumber}`;
    } catch (error) {
        throwDbError('Gagal mendapatkan nomor sesi opname baru', error);
    }
};

// ===================================
// 2. START SESSION (Insert Initial Data)
// ===================================
exports.startOpnameSession = async (gdgKode, user) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const sessionID = await exports.getNewSessionID();

        const sqlInit = `
    INSERT INTO topname_mmt (
        opn_session_id, opn_barcode, opn_brg_kode, 
        opn_gdg_kode, opn_stok_sistem, opn_user, opn_status
    )
    SELECT 
        ?, m.mst_barcode, m.mst_brg_kode, m.mst_gdg_kode, 
        ROUND(SUM(m.mst_stok_in * m.mst_panjang) - SUM(m.mst_stok_out * m.mst_panjang), 3) AS Stok,
        ?, 'PENDING' -- Paksa status menjadi PENDING di awal
    FROM tmasterstok_mmt m
    WHERE m.mst_gdg_kode = ?
    GROUP BY m.mst_barcode, m.mst_brg_kode, m.mst_gdg_kode
    HAVING Stok > 0;
`;

        await connection.query(sqlInit, [sessionID, user, gdgKode]);
        
        await connection.commit();
        return { success: true, sessionID: sessionID };
    } catch (error) {
        await connection.rollback();
        throwDbError('Gagal memulai sesi opname', error);
    } finally {
        connection.release();
    }
};

// ===================================
// 3. SCAN BARCODE (Validation)
// ===================================

exports.scanBarcodeOpname = async (barcode, sessionID) => {
    try {
        const sql = `
            SELECT 
                o.opn_barcode AS Barcode,
                o.opn_brg_kode AS Kode,
                TRIM(b.brg_nama) AS Nama_Bahan,
                o.opn_stok_sistem AS Stok_Sistem,
                o.opn_stok_fisik AS opn_stok_fisik,
                o.opn_status AS opn_status -- Pastikan menggunakan opn_status agar sinkron dengan Frontend
            FROM topname_mmt o
            LEFT JOIN tbarang_mmt b ON o.opn_brg_kode = b.brg_kode
            WHERE o.opn_barcode = ? AND o.opn_session_id = ?;
        `;

        const [results] = await pool.query(sql, [barcode, sessionID]);
        return results[0] || null;
    } catch (error) {
        throwDbError('Gagal scan barcode opname', error);
    }
};
// ===================================
// 4. UPDATE RESULT (Submit Scan)
// ===================================
exports.updateScanResult = async (sessionID, barcode, fisik) => {
    try {
        const sql = `
            UPDATE topname_mmt 
            SET 
                opn_stok_fisik = ?,
                opn_selisih = ? - opn_stok_sistem,
                opn_status = IF(? - opn_stok_sistem = 0, 'MATCHED', 'DISCREPANCY')
            WHERE opn_session_id = ? AND opn_barcode = ?;
        `;

        const [result] = await pool.query(sql, [fisik, fisik, fisik, sessionID, barcode]);
        return result.affectedRows > 0;
    } catch (error) {
        throwDbError('Gagal mengupdate hasil opname', error);
    }
};

// ===================================
// 5. GET PENDING ITEMS
// ===================================
// Ubah nama dari getPendingItems menjadi getAllSessionData
exports.getAllSessionData = async (sessionID) => {
    try {
        const sql = `
            SELECT 
                o.opn_barcode AS Barcode,
                o.opn_brg_kode AS Kode,
                TRIM(b.brg_nama) AS Nama_Bahan,
                o.opn_stok_sistem AS Stok_Sistem,
                o.opn_stok_fisik AS opn_stok_fisik, -- Tambahkan ini untuk kolom kanan
                o.opn_status AS opn_status         -- Tambahkan ini untuk filter kolom
            FROM topname_mmt o
            LEFT JOIN tbarang_mmt b ON o.opn_brg_kode = b.brg_kode
            WHERE o.opn_session_id = ?
            ORDER BY o.opn_status DESC, b.brg_nama ASC; -- PENDING biasanya abjadnya lebih akhir, atau atur manual
        `;

        const [results] = await pool.query(sql, [sessionID]);
        return results;
    } catch (error) {
        throwDbError('Gagal mengambil data sesi opname', error);
    }
};