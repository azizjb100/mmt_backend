const pool = require('../config/db.config');
const { format } = require('date-fns');

const throwDbError = (message, error) => { 
    throw new Error(message + ': ' + error.message); 
};

/**
 * Mendapatkan nomor urut otomatis untuk Retur Produksi
 * Format: MMT.RP.YYMM.0001
 */
exports.getNewNomorRetur = async () => {
    const NOMERATOR = 'MMT.RP'; // RP untuk Retur Produksi
    try {
        const currentYYMM = format(new Date(), 'yyMM');
        const searchPattern = `${NOMERATOR}.${currentYYMM}.%`;

        const sql = `
            SELECT MAX(ret_nomor) AS MaxNomor 
            FROM tret_hdr_mmt 
            WHERE ret_nomor LIKE ?;
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
        throwDbError('Gagal mendapatkan nomor retur baru', error);
    }
};

/**
 * Menyimpan data Retur Produksi (Header & Detail)
 */
exports.saveReturProduksi = async (data, isUpdate = false, userLogin) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let { 
            Nomor, 
            Gudang, 
            Tanggal, 
            Keterangan, 
            SupplierKode, // Jika ada field supplier (ret_sup_kode)
            NoPermintaan, // Relasi ke nomor permintaan asli (ret_rec_nomor)
            Details 
        } = data;

        const serverTime = new Date();
        const activeUser = userLogin || 'SYSTEM';

        // 1. Logika Penomoran
        if (!isUpdate && (!Nomor || Nomor === 'AUTO')) {
            Nomor = await exports.getNewNomorRetur();
        }

        if (isUpdate) {
            // Update Header
            await connection.query(
                `UPDATE tret_hdr_mmt SET 
                    ret_gdg_kode=?, 
                    ret_tanggal=?, 
                    ret_sup_kode=?,
                    ret_rec_nomor=?,
                    ret_memo=?, 
                    user_modified=?, 
                    date_modified=? 
                WHERE ret_nomor=?`,
                [Gudang, Tanggal, SupplierKode || '', NoPermintaan || '', Keterangan, activeUser, serverTime, Nomor]
            );
            // Hapus detail lama untuk diganti yang baru
            await connection.query('DELETE FROM tret_dtl_mmt WHERE retd_ret_nomor = ?', [Nomor]);
        } else {
            // Insert Header Baru
            await connection.query(
                `INSERT INTO tret_hdr_mmt 
                    (ret_nomor, ret_gdg_kode, ret_tanggal, ret_sup_kode, ret_rec_nomor, ret_memo, user_create, date_create) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [Nomor, Gudang, Tanggal, SupplierKode || '', NoPermintaan || '', Keterangan, activeUser, serverTime]
            );
        }

        // 2. Simpan Detail Retur
        if (Details && Details.length > 0) {
            const detailValues = Details.map((d, index) => [
                Nomor,              // retd_ret_nomor
                d.sku,              // retd_brg_kode
                d.satuan,           // retd_brg_satuan
                d.qty,              // retd_qty
                d.harga || 0,       // retd_harga
                d.diskon || 0,      // retd_discpr
                index + 1,          // retd_nourut
                d.expired || null,  // retd_expired (DATE)
                d.keterangan || ''  // retd_keterangan
            ]);

            await connection.query(
                `INSERT INTO tret_dtl_mmt 
                (retd_ret_nomor, retd_brg_kode, retd_brg_satuan, retd_qty, retd_harga, retd_discpr, retd_nourut, retd_expired, retd_keterangan) 
                VALUES ?`, [detailValues]
            );
        }

        await connection.commit();
        return { success: true, nomor: Nomor };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

/**
 * Menghapus data Retur
 */
exports.deleteReturProduksi = async (nomor) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('DELETE FROM tret_dtl_mmt WHERE retd_ret_nomor = ?', [nomor]);
        const [result] = await connection.query('DELETE FROM tret_hdr_mmt WHERE ret_nomor = ?', [nomor]);
        await connection.commit();
        return result.affectedRows > 0;
    } catch (error) {
        await connection.rollback();
        throwDbError('Gagal menghapus data retur', error);
    } finally {
        connection.release();
    }
};