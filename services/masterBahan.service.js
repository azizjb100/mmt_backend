// backend/src/services/masterBahan.service.js

const pool = require('../config/db.config'); 
const throwDbError = (message, error) => { throw new Error(message + ': ' + error.message); };

// ===================================
// 1. READ ALL (btnRefreshClick)
// ===================================


exports.getBahanLookupDataMmt = async (keyword) => {
    try {
        let sql = `
            SELECT 
                brg_kode AS Kode, 
                brg_nama AS Nama, 
                brg_jenis AS Jenis,
                brg_satuan AS Satuan,
                brg_panjang AS Panjang, 
                brg_lebar AS Lebar,
                brg_stok AS Stok
            FROM tbarang_mmt
            WHERE brg_gdg_default = 'WH-16' 
        `;
        const params = [];
        
        if (keyword) {

            sql += ` AND (brg_kode LIKE ? OR brg_nama LIKE ?)`;
            const searchKeyword = `%${keyword}%`;
            params.push(searchKeyword, searchKeyword);
        }

        sql += ` ORDER BY brg_nama`;
        
        const [rows] = await pool.query(sql, params);
        return rows; // Mengembalikan data untuk ditampilkan di tabel modal

    } catch (error) {
        throwDbError('Gagal mengambil data Master Bahan untuk lookup', error);
    }
};

exports.getBahanDetailByKodeMmt = async (kode) => {
    try {
        const sql = `
            SELECT 
                brg_kode AS Kode, 
                brg_nama AS Nama, 
                brg_satuan AS Satuan,
                brg_panjang AS Panjang, 
                brg_lebar AS Lebar
            FROM tbarang_mmt 
            WHERE brg_kode = ? AND brg_gdg_default = 'WH-16';
        `;
        
        const [rows] = await pool.query(sql, [kode]);
        if (rows.length === 0) throw new Error("Kode Bahan tidak ditemukan.");
        
        return rows[0]; // Mengembalikan objek tunggal detail bahan

    } catch (error) {
        throwDbError(`Gagal memuat detail Bahan dengan kode ${kode}`, error);
    }
};


exports.getLookupGdgProduksiMMT = async (keyword) => {
    try {

        let sql = `
            SELECT 
                b.brg_kode AS Kode,
                b.brg_nama AS Nama,
                b.brg_jenis AS Jenis,
                b.brg_satuan AS Satuan,
                b.brg_panjang AS Panjang,
                b.brg_lebar AS Lebar,
                COALESCE(SUM(s.mst_stok_in) - SUM(s.mst_stok_out), 0) AS Stok
            FROM tbarang_mmt b
            LEFT JOIN tmasterstok_mmt s 
                ON s.mst_brg_kode = b.brg_kode
                AND s.mst_gdg_kode = 'GPM'
        `;

        const params = [];

        // Tambah filter keyword di WHERE
        if (keyword) {
            sql += ` AND (b.brg_kode LIKE ? OR b.brg_nama LIKE ?)`;
            const key = `%${keyword}%`;
            params.push(key, key);
        }

        sql += `
            GROUP BY 
                b.brg_kode,
                b.brg_nama,
                b.brg_jenis,
                b.brg_satuan,
                b.brg_panjang,
                b.brg_lebar
            HAVING Stok > 0
            ORDER BY Nama
        `;

        const [rows] = await pool.query(sql, params);
        return rows;

    } catch (error) {
        throwDbError('Gagal mengambil data Master Bahan untuk lookup', error);
    }
};




// exports.getBahanData = async () => {
//     try {
//         // Replikasi SQLMaster dari Delphi, termasuk filter kritis.
//         // Catatan: Kolom Dead_Stock harus dihitung atau disediakan oleh DB.
//         const sql = `
//             SELECT 
//                 b.bhn_kode AS Kode,
//                 b.bhn_name AS Nama,
//                 b.bhn_satuan AS Satuan,
//                 b.bhn_gramasi AS Gramasi,
//                 b.bhn_setting AS Setting,
//                 b.bhn_jb_kode AS Jenis,
//                 -- SIMULASI UNTUK LOGIKA CONDITIONAL STYLING (cxStyle1)
//                 CASE WHEN b.bhn_kode LIKE 'DS%' THEN 'YA' ELSE 'TIDAK' END AS Dead_Stock 
//             FROM tbahan b
//             WHERE b.bhn_aktif = 0 AND b.bhn_jb_kode = 'LL'
//             ORDER BY b.bhn_name;
//         `;
        
//         const [rows] = await pool.query(sql);
//         return rows;

//     } catch (error) {
//         throwDbError('Gagal mengambil data Master Bahan', error);
//     }
// };

// exports.getBahanByKode = async (kode) => {
//     try {
//         const sql = `
//             SELECT *
//             FROM tbahan 
//             WHERE bhn_kode = ? AND bhn_aktif = 0;
//         `;
        
//         const [rows] = await pool.query(sql, [kode]);
//         if (rows.length === 0) throw new Error("Kode Bahan tidak ditemukan.");
        
//         return rows[0];

//     } catch (error) {
//         throwDbError(`Gagal memuat detail Bahan dengan kode ${kode}`, error);
//     }
// };