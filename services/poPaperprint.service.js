// backend/src/services/poPaperprint.service.js

const pool = require('../config/db.config'); 
const { format } = require('date-fns');

const throwDbError = (message, error) => {
    console.error(message, error.message);
    throw new Error(message + ': ' + error.message);
};

// ========================================================
// READ MASTER DATA (btnRefreshClick - SQLMaster)
// FIX: Deklarasikan menggunakan const
const getPoPaperprintMaster = async (startDate, endDate) => { 
    // Logika SQL Master...
    const sqlMaster = `
        SELECT
            pjh_nomor AS Nomor,
            pjh_cab AS Cab,
            DATE_FORMAT(pjh_tanggal, '%d-%M-%Y') AS Tanggal,
            pjh_sup_kode AS KodeSup,
            s.Sup_nama AS Supplier,
            pjh_ket AS Keterangan
        FROM tpopaper_hdr pjh
        LEFT JOIN tsupplier s ON s.Sup_kode = pjh.pjh_sup_kode
        WHERE pjh_tanggal BETWEEN ? AND ?
        GROUP BY pjh_nomor
        ORDER BY pjh_tanggal DESC
    `;

    try {
        const [rows] = await pool.query(sqlMaster, [startDate, endDate]);
        return rows;
    } catch (error) {
        throwDbError('Gagal memuat data master PO Paperprint', error);
    }
};

// ========================================================
// READ DETAIL DATA (loadDetails - SQLDetail)
// FIX: Deklarasikan menggunakan const
const getPoPaperprintDetail = async (nomor) => {
    const sqlDetail = `
        SELECT
            pjd_nomor AS Nomor,
            pjd_spk AS SPK,
            pjd_bahan AS Bahan,
            pjd_ukuran AS Ukuran,
            pjd_qty AS Qty,
            pjd_harga AS Harga,
            pjd_ket AS Keterangan
        FROM tpopaper_dtl
        WHERE pjd_nomor = ? 
        ORDER BY pjd_nomor
    `;

    try {
        const [rows] = await pool.query(sqlDetail, [nomor]);
        return rows;
    } catch (error) {
        throwDbError('Gagal memuat data detail PO Paperprint', error);
    }
};

// ========================================================
// DELETE (cxButton4Click)
// FIX: Deklarasikan menggunakan const
const deletePoPaperprint = async (nomor) => {
    // Logika delete PO Paperprint
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const sqlDeleteDetail = 'DELETE FROM tpo_paper_dtl WHERE pjd_nomor = ?';
        await connection.query(sqlDeleteDetail, [nomor]);

        const sqlDeleteHeader = 'DELETE FROM tpo_paper_hdr WHERE pjh_nomor = ?';
        const [headerResult] = await connection.query(sqlDeleteHeader, [nomor]);
        
        if (headerResult.affectedRows === 0) {
            throw new Error("Nomor transaksi tidak ditemukan atau sudah terhapus.");
        }
        
        await connection.commit();
        return true;
        
    } catch (error) {
        if (connection) await connection.rollback();
        throwDbError('Gagal menghapus transaksi PO Paperprint', error);
    } finally {
        if (connection) connection.release();
    }
};

// --- EKSPOR FINAL (Module.exports) ---
module.exports = { // Baris ini harusnya baris 100-an
    getPoPaperprintMaster, // Sekarang didefinisikan sebagai const
    getPoPaperprintDetail,
    deletePoPaperprint
};