// backend/src/services/stbj.service.js

const pool = require('../config/db.config');
const { format } = require('date-fns');

/**
 * Helper untuk menangani error database
 */
const throwDbError = (message, error) => {
    console.error(error);
    throw new Error(`${message}: ${error.message}`);
};

/**
 * BROWSE DATA STBJ (Logika btnRefreshClick di Delphi)
 */
exports.getBrowseSTBJ = async (startDate, endDate, gdgKode) => {
    try {
        const sqlMaster = `
            SELECT 
                stbj_nomor AS Nomor, 
                stbj_tanggal AS Tanggal,
                stbj_keterangan AS Keterangan, 
                stbj_gdg_kode AS GudangKode, 
                g.gdg_nama AS Gudang, 
                p.gdgp_nama AS Dari,
                IFNULL(ts.ts_nomor, "") AS NomorTerima, 
                ts.ts_tanggal AS TglTerima,
                IFNULL((
                    SELECT 
                        IF(pin_acc='' AND pin_dipakai='', 'WAIT',
                        IF(pin_acc='Y' AND pin_dipakai='', 'ACC',
                        IF(pin_acc='Y' AND pin_dipakai='Y', '',
                        IF(pin_acc='N', 'TOLAK', ''))))
                    FROM tspk_pin5 
                    WHERE pin_trs='STBJ' AND pin_nomor=stbj_nomor 
                    ORDER BY pin_urut DESC LIMIT 1
                ), "") AS Ngedit,
                h.user_create AS Usr
            FROM tstbj_hdr h
            LEFT JOIN tgudang g ON g.gdg_kode = h.stbj_gdg_kode
            LEFT JOIN tgudangproduksi p ON p.gdgp_kode = h.stbj_gdgp_kode
            LEFT JOIN retail.tdc_stbj_hdr ts ON ts.ts_stbj = h.stbj_nomor
            WHERE h.stbj_tanggal >= ? AND h.stbj_tanggal <= ?
              AND h.stbj_gdg_kode LIKE ?
            ORDER BY h.date_create ASC;
        `;

        const [rows] = await pool.query(sqlMaster, [startDate, endDate, `%${gdgKode}%`]);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data browse STBJ', error);
    }
};

/**
 * GET DETAIL DATA STBJ (Untuk sub-grid)
 */
exports.getDetailSTBJ = async (nomor) => {
    try {
        const sqlDetail = `
            SELECT 
                stbjd_stbj_nomor AS Nomor, 
                stbjd_spk_nomor AS Spk_Nomor, 
                IFNULL(s.spk_nama, i.spgi_nama) AS Nama, 
                s.spk_ukuran AS Ukuran, 
                stbjd_size AS Size,
                stbjd_jumlah AS Jumlah, 
                stbjd_koli AS Koli, 
                stbjd_keterangan AS Keterangan
            FROM tstbj_dtl
            LEFT JOIN tspk s ON s.spk_nomor = stbjd_spk_nomor
            LEFT JOIN tspk_gudangitem i ON i.spgi_spk = stbjd_spk_nomor
            WHERE stbjd_stbj_nomor = ?;
        `;
        const [rows] = await pool.query(sqlDetail, [nomor]);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil detail STBJ', error);
    }
};

/**
 * GENERATE NOMOR OTOMATIS (Logika getmaxnomor di Delphi)
 */
exports.getNewNomorSTBJ = async (tahun) => {
    try {
        // Format di Delphi: STBJ/00001/2023
        const sql = `
            SELECT IFNULL(MAX(SUBSTR(stbj_nomor, 6, 5)), 0) AS lastNumber 
            FROM tstbj_hdr
            WHERE LEFT(stbj_nomor, 4) = 'STBJ'
              AND RIGHT(stbj_nomor, 4) = ?;
        `;
        const [results] = await pool.query(sql, [tahun]);
        const nextNumber = parseInt(results[0].lastNumber) + 1;
        const paddedNumber = nextNumber.toString().padStart(5, '0');
        
        return `STBJ/${paddedNumber}/${tahun}`;
    } catch (error) {
        throwDbError('Gagal generate nomor STBJ', error);
    }
};

/**
 * SIMPAN DATA STBJ (Logika simpandata di Delphi)
 */
exports.saveSTBJ = async (payload, isUpdate = false, userLogin) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let { Nomor, Tanggal, Keterangan, Gudang, GudangProduksi, Items, DetailDC } = payload;
        const serverTime = new Date();
        const activeUser = userLogin || 'SYSTEM';

        // 1. Logika Nomor Baru
        if (!isUpdate) {
            const tahun = format(new Date(Tanggal), 'yyyy');
            Nomor = await exports.getNewNomorSTBJ(tahun);
        }

        // 2. Insert/Update Header
        if (isUpdate) {
            await connection.query(
                `UPDATE tstbj_hdr SET 
                    stbj_tanggal=?, stbj_keterangan=?, stbj_gdg_kode=?, 
                    stbj_gdgp_kode=?, date_modified=?, user_modified=? 
                 WHERE stbj_nomor=?`,
                [Tanggal, Keterangan, Gudang, GudangProduksi, serverTime, activeUser, Nomor]
            );
            // Hapus detail lama untuk replace
            await connection.query(`DELETE FROM tstbj_dtl WHERE stbjd_stbj_nomor = ?`, [Nomor]);
            await connection.query(`DELETE FROM retail.tdc_stbj WHERE tsd_nomor = ?`, [Nomor]);
        } else {
            await connection.query(
                `INSERT INTO tstbj_hdr 
                    (stbj_nomor, stbj_tanggal, stbj_keterangan, stbj_gdg_kode, stbj_gdgp_kode, date_create, user_create) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [Nomor, Tanggal, Keterangan, Gudang, GudangProduksi, serverTime, activeUser]
            );
        }

        // 3. Simpan Detail Utama (tstbj_dtl)
        if (Items && Items.length > 0) {
            for (const item of Items) {
                if (item.nama && item.jumlah > 0) {
                    await connection.query(
                        `INSERT INTO tstbj_dtl 
                            (stbjd_stbj_nomor, stbjd_spk_nomor, stbjd_size, stbjd_jumlah, stbjd_koli, stbjd_keterangan, stbjd_packing) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [Nomor, item.kode, item.size, item.jumlah, item.koli, item.ket, item.packing || ""]
                    );

                    // Logika khusus WH003: Update link ke tabel packing retail
                    if (Gudang === 'WH003' && item.packing) {
                        await connection.query(
                            `UPDATE retail.tpacking SET pack_nostbj = ? WHERE pack_nomor = ?`,
                            [Nomor, item.packing]
                        );
                    }
                }
            }
        }

        // 4. Simpan Detail DC Kaosan (retail.tdc_stbj)
        if (Gudang === 'WH003' && DetailDC && DetailDC.length > 0) {
            const dcValues = DetailDC.filter(dc => dc.nama && dc.jumlah > 0).map(dc => [
                Nomor, dc.packing || "", dc.spk, dc.kode, dc.size, dc.jumlah
            ]);

            if (dcValues.length > 0) {
                await connection.query(
                    `INSERT INTO retail.tdc_stbj 
                        (tsd_nomor, tsd_packing, tsd_spk_nomor, tsd_kode, tsd_ukuran, tsd_jumlah) 
                     VALUES ?`, [dcValues]
                );
            }
        }

        await connection.commit();
        return { success: true, nomor: Nomor };
    } catch (error) {
        await connection.rollback();
        throwDbError('Gagal menyimpan transaksi STBJ', error);
    } finally {
        connection.release();
    }
};

/**
 * DELETE DATA STBJ (Logika cxButton4Click di Delphi)
 */
exports.deleteSTBJ = async (nomor, gdgKode) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Logika khusus WH003: Reset link di tabel packing sebelum hapus STBJ
        if (gdgKode === 'WH003') {
            await connection.query(
                `UPDATE retail.tpacking SET pack_nostbj = NULL WHERE pack_nostbj = ?`,
                [nomor]
            );
        }

        // Hapus detail-detail
        await connection.query(`DELETE FROM retail.tdc_stbj WHERE tsd_nomor = ?`, [nomor]);
        await connection.query(`DELETE FROM tstbj_dtl WHERE stbjd_stbj_nomor = ?`, [nomor]);
        
        // Hapus Header
        const [result] = await connection.query(`DELETE FROM tstbj_hdr WHERE stbj_nomor = ?`, [nomor]);

        await connection.commit();
        return result.affectedRows > 0;
    } catch (error) {
        await connection.rollback();
        throwDbError('Gagal menghapus STBJ', error);
    } finally {
        connection.release();
    }
};