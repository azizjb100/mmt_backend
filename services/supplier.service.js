// backend/src/services/supplierService.js

const pool = require('../config/db.config'); 

const throwDbError = (message, error) => {
    console.error(message, error.message);
    throw new Error(message + ': ' + error.message);
};

// Replikasi logika SQLMaster dari ufrmBrowseSupplier.btnRefreshClick
exports.getSuppliers = async (keyword) => {
    try {
        let sql = `
            SELECT
                sup_kode AS Kode,
                sup_nama AS Nama,
                sup_alamat AS Alamat,
                sup_kota AS Kota,
                sup_telp AS Telp
            FROM tsupplier
        `;
        const params = [];
        
        // Menambahkan filter jika ada kata kunci pencarian
        if (keyword) {
            sql += `
                WHERE sup_kode LIKE ? OR sup_nama LIKE ?
            `;
            // Menyiapkan parameter untuk prepared statement
            const searchKeyword = `%${keyword}%`;
            params.push(searchKeyword, searchKeyword); 
        }

        sql += ` ORDER BY sup_nama`;
        
        const [rows] = await pool.query(sql, params);
        return rows;

    } catch (error) {
        throwDbError('Gagal mengambil data supplier dari database', error);
    }
};