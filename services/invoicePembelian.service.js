// backend/src/services/invoicePembelian.service.js

const pool = require('../config/db.config');
const { format, parseISO, isValid } = require('date-fns');

const throwDbError = (message, error) => {
    console.error(message, error.message);
    throw new Error(message + ': ' + error.message);
};

// ===================================
// GENERATE NOMOR INVOICE
// ===================================
exports.generateMaxKode = async (perushKode, tanggalInput) => {
    const tanggal = new Date(tanggalInput);
    if (isNaN(tanggal.getTime())) throw new Error('Tanggal tidak valid');

    const yearMonth = format(tanggal, 'yyMM'); // Hasil: 2602
    
    // Prefix yang diinginkan: INVP/KP/2602
    const prefix = `INVP/KP/${yearMonth}`;
    
    // Query untuk mencari nomor terakhir dengan prefix tersebut
    const sql = `
        SELECT MAX(CAST(SUBSTRING_INDEX(invp_nomor, '/', -1) AS UNSIGNED)) AS max_num
        FROM tinvp_hdr
        WHERE invp_nomor LIKE ?
    `;

    // Kita cari yang diawali 'INVP/KP/2602/%'
    const [rows] = await pool.query(sql, [`${prefix}/%`]);

    const nextNum = (rows[0].max_num || 0) + 1;
    
    // Gunakan padStart 4 agar hasilnya 0001, 0002, dst. 
    // Jika ingin 5 digit, ubah angka 4 menjadi 5.
    const padded = String(nextNum).padStart(4, '0');

    // Hasil Akhir: INVP/KP/2602/0001
    return `${prefix}/${padded}`;
};

// ===================================
// READ BY NOMOR (DETAIL VIEW)
// ===================================
exports.getInvoicePembelianByNomor = async (nomor) => {
    try {
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
            ...headerRows[0],
            Detail: detailRows
        };
    } catch (error) {
        throwDbError('Gagal mengambil Invoice Pembelian', error);
    }
};

// ===================================
// READ ALL (LIST DENGAN EXPAND DETAIL)
// ===================================
exports.getInvoicePembelianData = async (startDate, endDate) => {
    try {
        // 1. Query Header
        const sqlMaster = `
            SELECT
                h.invp_nomor AS Nomor,
                DATE_FORMAT(h.invp_tanggal,'%d-%m-%Y') AS Tanggal,
                s.sup_nama AS Supplier,
                h.invp_status AS Status,
                IFNULL(SUM(d.invpd_jumlah * d.invpd_harga), 0) AS Total
            FROM tinvp_hdr h
            LEFT JOIN tsupplier s ON s.sup_kode = h.invp_sup_kode
            LEFT JOIN tinvp_dtl d ON d.invpd_inv_nomor = h.invp_nomor
            WHERE h.invp_tanggal BETWEEN ? AND ?
            GROUP BY h.invp_nomor, h.invp_tanggal, s.sup_nama, h.invp_status
            ORDER BY h.invp_tanggal DESC
        `;
        const [masterResults] = await pool.query(sqlMaster, [startDate, endDate]);
        
        if (masterResults.length === 0) return [];

        const masterNomors = masterResults.map(row => row.Nomor);

        // 2. Query Detail (Batch fetching untuk semua nomor yang ada di list)
        const sqlDetail = `
            SELECT
                invpd_inv_nomor AS Nomor,
                invpd_nourut AS NoUrut,
                invpd_brg_kode AS Kode,
                invpd_brg_nama AS Nama,
                invpd_satuan AS Satuan,
                invpd_jumlah AS Jumlah,
                invpd_harga AS Harga,
                (invpd_jumlah * invpd_harga) AS SubTotal
            FROM tinvp_dtl
            WHERE invpd_inv_nomor IN (?)
            ORDER BY invpd_inv_nomor, invpd_nourut
        `;
        const [detailResults] = await pool.query(sqlDetail, [masterNomors]);

        // 3. Mapping Detail ke Header (Data Map)
        const dataMap = new Map();
        masterResults.forEach(item => {
            dataMap.set(item.Nomor, { ...item, Detail: [] });
        });

        detailResults.forEach(detail => {
            if (dataMap.has(detail.Nomor)) {
                const { Nomor, ...detailContent } = detail;
                dataMap.get(Nomor).Detail.push(detailContent);
            }
        });

        return Array.from(dataMap.values());
    } catch (error) {
        throwDbError('Gagal mengambil data Invoice Pembelian', error);
    }
};

// ===================================
// SAVE (INSERT / UPDATE)
// ===================================
const postJurnal = async (connection, { tgl, bukti, keterangan, akun, debet, kredit, user }) => {
    const sql = `
        INSERT INTO tjurnal_mmt 
        (jur_tanggal, jur_bukti, jur_keterangan, jur_akun_kode, jur_debet, jur_kredit, user_create) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await connection.query(sql, [tgl, bukti, keterangan, akun, debet, kredit, user]);
};


exports.saveInvoicePembelian = async (data, nomorToEdit, userLogin) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Generate Nomor
        const currentNomor = nomorToEdit
            ? nomorToEdit
            : await exports.generateMaxKode(data.invp_perush_kode || 'KP', data.inv_tanggal);

        const serverTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
        const activeUser = userLogin; 

        const isPpn = data.inv_is_ppn === 'Y';
        const ppnRate = parseFloat(data.inv_ppn_rate || 0);

        // 2. HEADER
        if (nomorToEdit) {
            const sqlUpdate = `
                UPDATE tinvp_hdr SET
                    invp_tanggal = ?, invp_tanggal_tempo = ?, invp_keterangan = ?,
                    invp_sup_kode = ?, invp_sup_alamat = ?, invp_sts_ppn = ?,
                    invp_ppn = ?, invp_grn_nomor = ?, date_modified = ?, user_modified = ?
                WHERE invp_nomor = ?
            `;
            await connection.query(sqlUpdate, [
                data.inv_tanggal, data.inv_tanggal_tempo, data.inv_keterangan,
                data.inv_sup_kode, data.inv_sup_alamat, isPpn ? 1 : 0,
                ppnRate, data.inv_rekening, serverTime, activeUser, currentNomor
            ]);
        } else {
            const sqlInsert = `
                INSERT INTO tinvp_hdr
                (invp_nomor, invp_perush_kode, invp_tanggal, invp_tanggal_tempo, invp_keterangan,
                 invp_sup_kode, invp_sup_alamat, invp_sts_ppn, invp_ppn, invp_grn_nomor, 
                 invp_status, date_create, user_create)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)
            `;
            await connection.query(sqlInsert, [
                currentNomor, data.invp_perush_kode || 'KP', data.inv_tanggal,
                data.inv_tanggal_tempo, data.inv_keterangan, data.inv_sup_kode,
                data.inv_sup_alamat, isPpn ? 1 : 0, ppnRate,
                data.inv_rekening, serverTime, activeUser
            ]);
        }

        // 3. DETAIL (Hapus dulu jika edit)
        await connection.query('DELETE FROM tinvp_dtl WHERE invpd_inv_nomor = ?', [currentNomor]);

        if (data.detail && data.detail.length > 0) {
            const detailValues = data.detail.map((d, index) => ([
                currentNomor, 
                data.inv_rekening, 
                d.kode_barang || '',    // Menyesuaikan payload frontend
                d.nama_barang, 
                d.satuan || '',         // Menyesuaikan payload frontend
                d.invd_jumlah || 0,
                d.invd_harga || 0, 
                index + 1
            ]));

            const sqlDetail = `
                INSERT INTO tinvp_dtl
                (invpd_inv_nomor, invpd_grn_nomor, invpd_brg_kode, invpd_brg_nama, 
                 invpd_satuan, invpd_jumlah, invpd_harga, invpd_nourut)
                VALUES ?
            `;
            await connection.query(sqlDetail, [detailValues]);
        }

        // 4. JURNAL OTOMATIS (Hapus jurnal lama jika edit)
        await connection.query('DELETE FROM tjurnal_mmt WHERE jur_bukti = ?', [currentNomor]);

        const subTotal = data.detail.reduce((sum, d) => sum + (parseFloat(d.invd_jumlah) * parseFloat(d.invd_harga)), 0);
        const ppnAmount = isPpn ? subTotal * (ppnRate / 100) : 0;
        const grandTotal = subTotal + ppnAmount;

        // Post Jurnal dengan activeUser agar konsisten
        await postJurnal(connection, {
            tgl: data.inv_tanggal, bukti: currentNomor,
            keterangan: `Pembelian dari Supplier ${data.inv_sup_kode}`,
            akun: '5101', debet: subTotal, kredit: 0, user: activeUser
        });

        if (ppnAmount > 0) {
            await postJurnal(connection, {
                tgl: data.inv_tanggal, bukti: currentNomor,
                keterangan: `PPN Masukan Invoice ${currentNomor}`,
                akun: '1105', debet: ppnAmount, kredit: 0, user: activeUser
            });
        }

        await postJurnal(connection, {
            tgl: data.inv_tanggal, bukti: currentNomor,
            keterangan: `Hutang Pembelian ${currentNomor}`,
            akun: '2101', debet: 0, kredit: grandTotal, user: activeUser
        });

        await connection.commit();
        return { Nomor: currentNomor };

    } catch (error) {
        await connection.rollback();
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