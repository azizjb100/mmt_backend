const pool = require('../config/db.config');
const { format, parseISO, isValid } = require('date-fns');
const jurnalService = require('./jurnal.service');

const throwDbError = (message, error) => {
    console.error(message, error.message);
    throw new Error(message + ': ' + error.message);
};

// ===================================
// GENERATE NOMOR PELUNASAN
// Format: PAYP/KP/2602/00001
// ===================================
exports.generateNomorPelunasan = async (perushKode, tanggalInput) => {
    const tanggal = (typeof tanggalInput === 'string') ? parseISO(tanggalInput) : tanggalInput;
    if (!isValid(tanggal)) throw new Error('Tanggal pelunasan tidak valid');

    const yearMonth = format(tanggal, 'yyMM');
    const currentYear = format(tanggal, 'yyyy');
    const prefix = `PAYP/${perushKode}`;
    
    const sql = `
        SELECT MAX(CAST(SUBSTRING_INDEX(pelh_nomor, '/', -1) AS UNSIGNED)) AS max_num
        FROM tpelunasan_pembelian_hdr
        WHERE pelh_nomor LIKE '${prefix}/%' AND YEAR(pelh_tanggal) = ?
    `;

    const [rows] = await pool.query(sql, [currentYear]);
    const nextNum = (rows[0].max_num || 0) + 1;
    const padded = String(nextNum).padStart(5, '0');

    return `${prefix}/${yearMonth}/${padded}`;
};

// ===================================
// SAVE PELUNASAN
// ===================================
exports.savePelunasan = async (data, userLogin) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const perush = data.pelh_perush_kode || 'KP';
        const nomorPelunasan = await exports.generateNomorPelunasan(perush, data.pelh_tanggal);

        // 1. INSERT HEADER
        const sqlHeader = `
            INSERT INTO tpelunasan_pembelian_hdr 
            (pelh_nomor, pelh_tanggal, pelh_sup_kode, pelh_akun_kas, pelh_keterangan, pelh_total_bayar, user_create)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        await connection.query(sqlHeader, [
            nomorPelunasan, 
            data.pelh_tanggal, 
            data.pelh_sup_kode, 
            data.pelh_akun_kas, 
            data.pelh_keterangan, 
            data.pelh_total_bayar, 
            userLogin
        ]);

        // 2. INSERT DETAIL & UPDATE STATUS INVOICE
        if (data.detail && data.detail.length > 0) {
            for (const item of data.detail) {
                // Simpan Detail Pelunasan
                const sqlDetail = `
                    INSERT INTO tpelunasan_pembelian_dtl (peld_nomor, peld_inv_nomor, peld_nominal)
                    VALUES (?, ?, ?)
                `;
                await connection.query(sqlDetail, [nomorPelunasan, item.peld_inv_nomor, item.peld_nominal]);

                // Update Status Invoice (Sangat sederhana: Langsung CLOSED)
                // Idealnya dicek dulu apakah (Total Bayar >= Total Invoice)
                const sqlUpdateInv = `UPDATE tinvp_hdr SET invp_status = 'CLOSED' WHERE invp_nomor = ?`;
                await connection.query(sqlUpdateInv, [item.peld_inv_nomor]);
            }
        }

        // 3. JURNAL OTOMATIS
        // DEBET: Hutang Usaha (2101)
        await jurnalService.postJurnal(connection, {
            tgl: data.pelh_tanggal,
            bukti: nomorPelunasan,
            keterangan: `Pelunasan Hutang ke Supplier ${data.pelh_sup_kode}`,
            akun: '2101', 
            debet: data.pelh_total_bayar,
            kredit: 0,
            user: userLogin,
            perush: perush
        });

        // KREDIT: Kas atau Bank (Dinamis dari input user)
        await jurnalService.postJurnal(connection, {
            tgl: data.pelh_tanggal,
            bukti: nomorPelunasan,
            keterangan: `Bayar Hutang: ${data.pelh_keterangan || nomorPelunasan}`,
            akun: data.pelh_akun_kas, 
            debet: 0,
            kredit: data.pelh_total_bayar,
            user: userLogin,
            perush: perush
        });

        await connection.commit();
        return { Nomor: nomorPelunasan };

    } catch (error) {
        await connection.rollback();
        throwDbError('Gagal menyimpan pelunasan', error);
    } finally {
        connection.release();
    }
};

// ===================================
// GET INVOICE OUTSTANDING (YANG BELUM LUNAS)
// ===================================
exports.getOutstandingInvoices = async (supKode) => {
    try {
        const sql = `
            SELECT 
                h.invp_nomor AS Nomor,
                h.invp_tanggal AS Tanggal,
                h.invp_tanggal_tempo AS JatuhTempo,
                IFNULL(SUM(d.invpd_jumlah * d.invpd_harga), 0) AS TotalInvoice
            FROM tinvp_hdr h
            JOIN tinvp_dtl d ON h.invp_nomor = d.invpd_inv_nomor
            WHERE h.invp_sup_kode = ? AND h.invp_status = 'OPEN'
            GROUP BY h.invp_nomor
        `;
        const [rows] = await pool.query(sql, [supKode]);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data outstanding invoice', error);
    }
};