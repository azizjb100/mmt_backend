const pool = require('../config/db.config');

const MmtService = {
    // Menyimpan data permintaan pinjam baru
    createPinjamRequest: async (data) => {
        const { barcode, operator, nomor_spk, nama_bahan, panjang, lebar } = data;
        const sql = `
            INSERT INTO tpermintaan_pinjam_mmt 
            (barcode, operator, nomor_spk, nama_bahan, panjang, lebar, status, tgl_permintaan) 
            VALUES (?, ?, ?, ?, ?, ?, 'PENDING', NOW())
        `;
        const [result] = await pool.query(sql, [barcode, operator, nomor_spk, nama_bahan, panjang, lebar]);
        return result;
    },

    // Mengambil semua permintaan yang statusnya masih PENDING
    getAllPendingLoans: async () => {
        const sql = `
            SELECT * FROM tpermintaan_pinjam_mmt 
            WHERE status = 'PENDING' 
            ORDER BY tgl_permintaan DESC
        `;
        const [rows] = await pool.query(sql);
        return rows;
    }
};

module.exports = MmtService;