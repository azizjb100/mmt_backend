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
        const activeUser = userLogin || 'SYSTEM'; // Fallback aman

        // 1. INSERT HEADER dengan user_create
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
            activeUser // Masukkan user di sini
        ]);

        // 2. INSERT DETAIL & UPDATE STATUS INVOICE
        if (data.detail && data.detail.length > 0) {
            for (const item of data.detail) {
                const sqlDetail = `
                    INSERT INTO tpelunasan_pembelian_dtl (peld_nomor, peld_inv_nomor, peld_nominal)
                    VALUES (?, ?, ?)
                `;
                await connection.query(sqlDetail, [nomorPelunasan, item.peld_inv_nomor, item.peld_nominal]);

                // Update Status Invoice
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
            user: activeUser, // Kirim user ke jurnal
            perush: perush
        });

        // KREDIT: Kas atau Bank
        await jurnalService.postJurnal(connection, {
            tgl: data.pelh_tanggal,
            bukti: nomorPelunasan,
            keterangan: `Bayar Hutang: ${data.pelh_keterangan || nomorPelunasan}`,
            akun: data.pelh_akun_kas, 
            debet: 0,
            kredit: data.pelh_total_bayar,
            user: activeUser, // Kirim user ke jurnal
            perush: perush
        });

        await connection.commit();
        return { Nomor: nomorPelunasan };

    } catch (error) {
        await connection.rollback();
        throw error;
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

exports.getAllOutstandingGlobal = async () => {
    try {
        const sql = `
            SELECT 
                h.invp_nomor AS Nomor,
                s.sup_nama AS Supplier,
                DATE_FORMAT(h.invp_tanggal, '%d-%m-%Y') AS Tanggal,
                DATE_FORMAT(h.invp_tanggal_tempo, '%d-%m-%Y') AS JatuhTempo,
                DATEDIFF(h.invp_tanggal_tempo, CURDATE()) AS SisaHari,
                IFNULL(SUM(d.invpd_jumlah * d.invpd_harga), 0) AS TotalTagihan
            FROM tinvp_hdr h
            LEFT JOIN tsupplier s ON s.sup_kode = h.invp_sup_kode
            JOIN tinvp_dtl d ON h.invp_nomor = d.invpd_inv_nomor
            WHERE h.invp_status = 'OPEN'
            GROUP BY h.invp_nomor
            ORDER BY h.invp_tanggal_tempo ASC
        `;
        const [rows] = await pool.query(sql);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil laporan hutang global', error);
    }
};

// ===================================
// READ ALL (LIST DATA DENGAN DETAIL)
// ===================================
exports.getPelunasanData = async (startDate, endDate) => {
    try {
        // 1. Query Header Pelunasan
        const sqlHeader = `
            SELECT 
                h.pelh_nomor AS Nomor,
                DATE_FORMAT(h.pelh_tanggal, '%d-%m-%Y') AS Tanggal,
                s.sup_nama AS Supplier,
                h.pelh_akun_kas AS MetodeBayar,
                h.pelh_total_bayar AS TotalBayar,
                h.pelh_keterangan AS Keterangan
            FROM tpelunasan_pembelian_hdr h
            LEFT JOIN tsupplier s ON s.sup_kode = h.pelh_sup_kode
            WHERE h.pelh_tanggal BETWEEN ? AND ?
            ORDER BY h.pelh_tanggal DESC, h.pelh_nomor DESC
        `;
        const [headers] = await pool.query(sqlHeader, [startDate, endDate]);

        if (headers.length === 0) return [];

        const listNomor = headers.map(h => h.Nomor);

        // 2. Query Detail (Batch fetch untuk semua nomor di list)
        const sqlDetail = `
            SELECT 
                peld_nomor AS Nomor,
                peld_inv_nomor,
                peld_nominal
            FROM tpelunasan_pembelian_dtl
            WHERE peld_nomor IN (?)
        `;
        const [details] = await pool.query(sqlDetail, [listNomor]);

        // 3. Mapping Detail ke masing-masing Header
        const dataMap = new Map();
        headers.forEach(h => {
            dataMap.set(h.Nomor, { ...h, Detail: [] });
        });

        details.forEach(d => {
            if (dataMap.has(d.Nomor)) {
                dataMap.get(d.Nomor).Detail.push({
                    peld_inv_nomor: d.peld_inv_nomor,
                    peld_nominal: d.peld_nominal
                });
            }
        });

        return Array.from(dataMap.values());
    } catch (error) {
        throwDbError('Gagal mengambil daftar pelunasan', error);
    }
};


// ===================================
// GET REKAP SALDO HUTANG PER SUPPLIER
// ===================================
exports.getSaldoHutangRekap = async () => {
    try {
        const sql = `
            SELECT 
                s.sup_kode AS KodeSupplier,
                s.sup_nama AS NamaSupplier,
                COUNT(h.invp_nomor) AS JumlahInvoice,
                SUM(detail.total_tagihan) AS TotalHutang,
                SUM(CASE WHEN h.invp_tanggal_tempo < CURDATE() THEN detail.total_tagihan ELSE 0 END) AS TelahJatuhTempo
            FROM tsupplier s
            JOIN tinvp_hdr h ON s.sup_kode = h.invp_sup_kode
            JOIN (
                SELECT invpd_inv_nomor, SUM(invpd_jumlah * invpd_harga) AS total_tagihan
                FROM tinvp_dtl
                GROUP BY invpd_inv_nomor
            ) detail ON h.invp_nomor = detail.invpd_inv_nomor
            WHERE h.invp_status = 'OPEN'
            GROUP BY s.sup_kode, s.sup_nama
            ORDER BY TotalHutang DESC
        `;
        const [rows] = await pool.query(sql);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil rekap saldo hutang', error);
    }
};