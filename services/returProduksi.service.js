// backend/src/services/returProduksi.service.js

const pool = require('../config/db.config');
const { format } = require('date-fns');

const throwDbError = (message, error) => { 
    throw new Error(message + ': ' + error.message); 
};

exports.getStokByBarcode = async (barcode, gudangAsal) => {
    try {
        const sql = `
            SELECT 
                m.mst_barcode AS Barcode, 
                m.mst_brg_kode AS Kode, 
                TRIM(b.brg_nama) AS Nama_Bahan, 
                b.brg_satuan AS Satuan, 
                MAX(m.mst_panjang) AS Panjang, 
                MAX(m.mst_lebar) AS Lebar,
                MAX(m.mst_spk_nomor) AS Nomor_SPK,
                SUM(COALESCE(m.mst_stok_in, 0) - COALESCE(m.mst_stok_out, 0)) AS Stok
            FROM tmasterstok_mmt m
            LEFT JOIN tbarang_mmt b ON m.mst_brg_kode = b.brg_kode
            WHERE m.mst_barcode = ? AND m.mst_gdg_kode = ?
            GROUP BY m.mst_barcode, m.mst_brg_kode, b.brg_nama, b.brg_satuan
            HAVING Stok > 0;
        `;

        const [results] = await pool.query(sql, [barcode, gudangAsal]);
        return results[0] || null;
    } catch (error) {
        throw new Error(`Gagal scan barcode retur: ${error.message}`);
    }
};

/**
 * Generate Nomor Dokumen Baru (MMT.RMP.YYMM.0001)
 */
exports.getNewNomor = async () => {
    const NOMERATOR = 'MMT.RMP';
    try {
        const currentYYMM = format(new Date(), 'yyMM');
        const searchPattern = `${NOMERATOR}.${currentYYMM}.%`;

        const sql = `
            SELECT MAX(rmnt_nomor) AS MaxNomor 
            FROM treturminta_mmt_hdr 
            WHERE rmnt_nomor LIKE ?;
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
 * Simpan atau Update Retur Produksi
 */
exports.saveReturProduksi = async (data, isUpdate = false, userLogin) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let { 
            Nomor, Tanggal, GudangTujuan, GudangAsal, 
            NomorSPK, Keterangan, Type, Details 
        } = data;

        const serverTime = new Date();
        const activeUser = userLogin || 'SYSTEM';

        if (!isUpdate && (!Nomor || Nomor === 'AUTO')) {
            Nomor = await exports.getNewNomor();
        }

        if (isUpdate) {
            // Update Header
            await connection.query(
                `UPDATE treturminta_mmt_hdr SET 
                    rmnt_tanggal=?, rmnt_gdg_kode=?, rmnt_gdg_asal=?, 
                    rmnt_spk_nomor=?, rmnt_keterangan=?, rmnt_type=?, 
                    user_modified=?, date_modified=? 
                WHERE rmnt_nomor=?`,
                [Tanggal, GudangTujuan, GudangAsal, NomorSPK, Keterangan, Type, activeUser, serverTime, Nomor]
            );
            // Hapus detail lama
            await connection.query('DELETE FROM treturminta_mmt_dtl WHERE rmntd_rmnt_nomor = ?', [Nomor]);
        } else {
            // Insert Header
            await connection.query(
                `INSERT INTO treturminta_mmt_hdr 
                    (rmnt_nomor, rmnt_tanggal, rmnt_gdg_kode, rmnt_gdg_asal, rmnt_spk_nomor, rmnt_keterangan, rmnt_type, user_create, date_create) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [Nomor, Tanggal, GudangTujuan, GudangAsal, NomorSPK, Keterangan, Type, activeUser, serverTime]
            );
        }

        // Simpan Detail
        if (Details && Details.length > 0) {
            const detailValues = Details.map((d, index) => [
                Nomor, 
                d.kode, 
                d.qty, 
                d.expired || null, 
                d.keterangan, 
                d.nourut || (index + 1), 
                GudangTujuan, 
                d.barcode, 
                d.panjang || 0, 
                d.lebar || 0
            ]);

            await connection.query(
                `INSERT INTO treturminta_mmt_dtl 
                (rmntd_rmnt_nomor, rmntd_brg_kode, rmntd_qty, rmntd_expired, rmntd_keterangan, rmntd_nourut, rmntd_gdg_kode, rmntd_barcode, rmntd_panjang, rmntd_lebar) 
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
 * Hapus Retur Produksi
 */
exports.deleteReturProduksi = async (nomor) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('DELETE FROM treturminta_mmt_dtl WHERE rmntd_rmnt_nomor = ?', [nomor]);
        const [result] = await connection.query('DELETE FROM treturminta_mmt_hdr WHERE rmnt_nomor = ?', [nomor]);
        await connection.commit();
        return result.affectedRows > 0;
    } catch (error) {
        await connection.rollback();
        throwDbError('Gagal menghapus data retur', error);
    } finally {
        connection.release();
    }
};