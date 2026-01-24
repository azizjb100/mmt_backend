// backend/src/services/invoicePembelian.service.js

const pool = require('../config/db.config');
const { format, parseISO, isValid } = require('date-fns');

const throwDbError = (message, error) => {
    console.error(message, error.message);
    throw new Error(message + ': ' + error.message);
};



exports.generateMaxKode = async (perushKode, tanggalInput) => {
    let tanggal;
    if (tanggalInput instanceof Date) {
        tanggal = tanggalInput;
    } else if (typeof tanggalInput === 'string') {
        tanggal = parseISO(tanggalInput);
    } else {
        throw new Error('Tanggal invoice tidak valid');
    }

    if (!isValid(tanggal)) throw new Error('Format tanggal invoice tidak valid');

    const year = format(tanggal, 'yyyy');
    const prefix = `INVP/${perushKode}`;
    const searchPattern = `${prefix}/%/${year}`;

    // Improved SQL: Direct substring to find the max number for the specific prefix and year
    const sql = `
        SELECT MAX(CAST(SUBSTR(invp_nomor, LENGTH(?) + 2, 5) AS UNSIGNED)) AS max_num
        FROM tinvp_hdr
        WHERE invp_nomor LIKE ?
    `;

    const [rows] = await pool.query(sql, [prefix, searchPattern]);

    const nextNum = (rows[0].max_num || 0) + 1;
    const padded = String(nextNum).padStart(5, '0');

    return `${prefix}/${padded}/${year}`;
};


// ===================================
// READ BY NOMOR
// ===================================
exports.getInvoicePembelianByNomor = async (nomor) => {
    try {
        // --- HEADER ---
        const sqlHeader = `
            SELECT
                h.invp_nomor AS Nomor,
                h.invp_tanggal AS Tanggal,
                h.invp_tanggal_tempo AS JatuhTempo,
                h.invp_keterangan AS Keterangan,
                h.invp_sup_kode AS SupplierKode,
                s.sup_nama AS SupplierNama,
                h.invp_sup_alamat AS SupplierAlamat,
                h.invp_ppn AS PPN,
                h.invp_sts_ppn AS IsPPN,
                h.invp_disc AS Diskon,
                h.invp_pph AS PPH,
                h.invp_status AS Status,
                h.invp_grn_nomor AS GRN
            FROM tinvp_hdr h
            LEFT JOIN tsupplier s ON s.sup_kode = h.invp_sup_kode
            WHERE h.invp_nomor = ?
        `;
        const [headerRows] = await pool.query(sqlHeader, [nomor]);

        if (headerRows.length === 0) {
            throw new Error(`Invoice Pembelian ${nomor} tidak ditemukan`);
        }

        const header = headerRows[0];

        // --- DETAIL ---
        const sqlDetail = `
            SELECT
                invpd_nourut AS NoUrut,
                invpd_brg_kode AS Kode,
                invpd_brg_nama AS Nama,
                invpd_satuan AS Satuan,
                invpd_jumlah AS Jumlah,
                invpd_harga AS Harga,
                (invpd_jumlah * invpd_harga) AS Total
            FROM tinvp_dtl
            WHERE invpd_inv_nomor = ?
            ORDER BY invpd_nourut
        `;
        const [detailRows] = await pool.query(sqlDetail, [nomor]);

        return {
            ...header,
            Detail: detailRows
        };

    } catch (error) {
        throwDbError('Gagal mengambil Invoice Pembelian', error);
    }
};

// ===================================
// READ ALL (LIST)
// ===================================
exports.getInvoicePembelianData = async (startDate, endDate) => {
    try {
        const sql = `
            SELECT
                h.invp_nomor AS Nomor,
                DATE_FORMAT(h.invp_tanggal,'%d-%m-%Y') AS Tanggal,
                s.sup_nama AS Supplier,
                h.invp_status AS Status,
                IFNULL(SUM(d.invpd_jumlah * d.invpd_harga),0) AS Total
            FROM tinvp_hdr h
            LEFT JOIN tsupplier s ON s.sup_kode = h.invp_sup_kode
            LEFT JOIN tinvp_dtl d ON d.invpd_inv_nomor = h.invp_nomor
            WHERE h.invp_tanggal BETWEEN ? AND ?
            GROUP BY h.invp_nomor
            ORDER BY h.invp_tanggal DESC
        `;
        const [rows] = await pool.query(sql, [startDate, endDate]);
        return rows;

    } catch (error) {
        throwDbError('Gagal mengambil data Invoice Pembelian', error);
    }
};

// ===================================
// SAVE (INSERT / UPDATE)
// ===================================
exports.saveInvoicePembelian = async (data, nomorToEdit, userLogin) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const currentNomor = nomorToEdit
            ? nomorToEdit
            : await exports.generateMaxKode(data.inv_perush_kode || 'KP', data.inv_tanggal);

        const serverTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

        // ================= HEADER =================
        if (nomorToEdit) {

            const sqlUpdate = `
                UPDATE tinvp_hdr SET
                    invp_tanggal = ?,
                    invp_tanggal_tempo = ?,
                    invp_keterangan = ?,
                    invp_sup_kode = ?,
                    invp_sup_alamat = ?,
                    invp_sts_ppn = ?,
                    invp_ppn = ?,
                    invp_grn_nomor = ?,
                    date_modified = ?,
                    user_modified = ?
                WHERE invp_nomor = ?
            `;

            await connection.query(sqlUpdate, [
                data.inv_tanggal,
                data.inv_tanggal_tempo,
                data.inv_keterangan,
                data.inv_sup_kode,
                data.inv_sup_alamat,
                data.isPpn ? 1 : 0,
                data.ppnRate || 0,
                data.inv_rekening,
                serverTime,
                userLogin,
                currentNomor
            ]);

            await connection.query(
                'DELETE FROM tinvp_dtl WHERE invpd_inv_nomor = ?',
                [currentNomor]
            );

        } else {

            const sqlInsert = `
    INSERT INTO tinvp_hdr
    (
        invp_nomor, invp_perush_kode,
        invp_tanggal, invp_tanggal_tempo, invp_keterangan,
        invp_sup_kode, invp_sup_alamat,
        invp_sts_ppn, invp_ppn,
        invp_grn_nomor, invp_status,
        date_create, user_create
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)
`;

await connection.query(sqlInsert, [
    currentNomor,
    data.invp_perush_kode || data.inv_perush_kode,   // 🔥 penting
    data.inv_tanggal,
    data.inv_tanggal_tempo,
    data.inv_keterangan,
    data.inv_sup_kode,
    data.inv_sup_alamat,
    data.isPpn ? 1 : 0,
    data.ppnRate || 0,
    data.inv_rekening,
    serverTime,
    userLogin
]);

        }
       // ================= DETAIL =================
if (data.detail && data.detail.length > 0) {

    const detailValues = data.detail.map((d, index) => ([
        currentNomor,
        data.inv_rekening,
        d.kode_barang || null,      // invpd_brg_kode
        d.nama_barang,              // invpd_brg_nama
        d.satuan || null,           // invpd_satuan
        d.invd_jumlah || 0,         // invpd_jumlah
        d.invd_harga || 0,          // invpd_harga
        index + 1                   // invpd_nourut
    ]));

    const sqlDetail = `
        INSERT INTO tinvp_dtl
        (
            invpd_inv_nomor, invpd_grn_nomor, 
            invpd_brg_kode, invpd_brg_nama, invpd_satuan, 
            invpd_jumlah, invpd_harga, invpd_nourut
        )
        VALUES ?
    `;

    await connection.query(sqlDetail, [detailValues]);
}

        await connection.commit();
        return { Nomor: currentNomor };

    } catch (error) {
        await connection.rollback();
        console.error("Error saveInvoicePembelian:", error);
        throw error;
    } finally {
        connection.release();
    }
};


// ===================================
// PRINT
// ===================================
exports.getInvoicePembelianForPrint = async (nomor) => {
    try {
        const data = await exports.getInvoicePembelianByNomor(nomor);

        const subTotal = data.Detail.reduce((sum, d) => sum + (d.Total || 0), 0);
        const totalNet = subTotal - (data.Diskon || 0);
        const ppnAmount = data.IsPPN ? totalNet * ((data.PPN || 0) / 100) : 0;

        return {
            Header: {
                ...data,
                SubTotal: subTotal,
                PpnAmount: ppnAmount,
                GrandTotal: totalNet + ppnAmount,
                TanggalFormat: format(new Date(data.Tanggal), 'dd/MM/yyyy')
            },
            Detail: data.Detail
        };

    } catch (error) {
        throwDbError('Gagal menyiapkan data cetak Invoice Pembelian', error);
    }
};
