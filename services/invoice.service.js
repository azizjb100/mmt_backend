// backend/src/services/invoice.service.js

const pool = require('../config/db.config');
const { format, parseISO } = require('date-fns');

// --- Helper: Penanganan Error Database ---
const throwDbError = (message, error) => {
    console.error(`${message}:`, error);
    throw new Error(`${message}: ${error.message || error}`);
};

/**
 * Helper: Get Max Nomor Invoice (ING/PERUSH/00001/2026)
 * Logika adaptasi dari fungsi getmaxnomor Delphi
 */
const getNextInvoiceNumber = async (perushKode, date, connection) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const prefix = `ING/${perushKode}`;
    const db = connection || pool;

    // Logika khusus tahun 2025 sesuai kodingan Delphi asli
    let extraFilter = "";
    if (prefix === 'ING/JA' && year === 2025) {
        extraFilter = "AND (MID(inv_nomor, 8, 5) < '01453' OR MID(inv_nomor, 8, 5) > '01473')";
    }

    const [rows] = await db.query(
        `SELECT IFNULL(MAX(CAST(SUBSTR(inv_nomor, 8, 5) AS UNSIGNED)), 0) AS max_num 
     FROM tinv_hdr 
     WHERE LEFT(inv_nomor, 6) = ? AND RIGHT(inv_nomor, 4) = ? ${extraFilter} FOR UPDATE`,
        [prefix, String(year)]
    );

    const lastNum = rows[0]?.max_num || 0;
    const nextNum = 100001 + lastNum;
    const padded = String(nextNum).substring(1); // Ambil 5 digit terakhir
    return `${prefix}/${padded}/${year}`;
};

const getInvoiceById = async (nomor) => {
    const sql = `
    SELECT 
      a.inv_nomor, a.inv_tanggal, a.inv_tanggal_tempo, a.inv_divisi, a.inv_keterangan,
      a.inv_invpro, a.inv_perush_kode, a.inv_rekening, a.inv_sts_ppn, a.inv_ppn, p.perush_nama,
      pd.perushd_bank, pd.perushd_atasnama, a.inv_cus_alamat, a.inv_pph, a.inv_disc,
      c.cus_kode, c.cus_nama, c.cus_alamat, c.cus_kota
    FROM tinv_hdr a
    INNER JOIN tperusahaan p ON p.perush_kode = a.inv_perush_kode
    INNER JOIN tcustomer c ON c.cus_kode = a.inv_cus_kode
    LEFT JOIN tperusahaan_dtl pd ON pd.perushd_perush_kode = p.perush_kode AND pd.perushd_rekening = a.inv_rekening
    WHERE a.inv_nomor = ?
  `;

    const [headerRows] = await pool.query(sql, [nomor]);
    if (headerRows.length === 0) return null;

    const [detailRows] = await pool.query(
        `SELECT 
      d.invd_sj_nomor, d.invd_spk_nomor, IFNULL(b.spk_nama2, x.brg_name) AS nama_barang,
      d.invd_ukuran, d.invd_jumlah, d.invd_harga,
      (d.invd_jumlah * d.invd_harga) AS total
     FROM tinv_dtl d
     LEFT JOIN tspk b ON d.invd_spk_nomor = b.spk_nomor
     LEFT JOIN tbarang x ON d.invd_spk_nomor = x.brg_kode
     WHERE d.invd_inv_nomor = ?
     ORDER BY d.invd_nourut`,
        [nomor]
    );

    return {
        ...headerRows[0],
        Detail: detailRows
    };
};

const saveInvoice = async (data, nomorToEdit, currentUser) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        let invNomor;
        const isUpdating = !!nomorToEdit;
        const {
            tanggal, tglTempo, divisi, keterangan, kodePerush, cusKode,
            alamatCus, rekening, invPro, isPpn, ppnRate, pph, diskon, detail
        } = data;

        const isPpnInt = isPpn ? 1 : 0;
        const ppnValue = isPpn ? parseFloat(ppnRate) : 0;

        if (isUpdating) {
            invNomor = nomorToEdit;
            await connection.query(
                `UPDATE tinv_hdr SET 
          inv_tanggal = ?, inv_tanggal_tempo = ?, inv_keterangan = ?, inv_perush_kode = ?, 
          inv_cus_kode = ?, inv_cus_alamat = ?, inv_rekening = ?, inv_invpro = ?, 
          inv_sts_ppn = ?, inv_ppn = ?, inv_disc = ?, inv_pph = ?, 
          date_modified = NOW(), user_modified = ?
         WHERE inv_nomor = ?`,
                [tanggal, tglTempo, keterangan, kodePerush, cusKode, alamatCus, rekening, invPro,
                    isPpnInt, ppnValue, diskon, pph, currentUser, invNomor]
            );

            // Kembalikan status SJ sebelum dihapus detailnya
            await connection.query(`UPDATE tsj_hdr SET sj_inv_nomor = '' WHERE sj_inv_nomor = ?`, [invNomor]);
            await connection.query(`DELETE FROM tinv_dtl WHERE invd_inv_nomor = ?`, [invNomor]);
        } else {
            invNomor = await getNextInvoiceNumber(kodePerush, tanggal, connection);
            await connection.query(
                `INSERT INTO tinv_hdr (
          inv_nomor, inv_divisi, inv_tanggal, inv_keterangan, inv_perush_kode, 
          inv_cus_kode, inv_cus_alamat, inv_tanggal_tempo, inv_rekening, 
          inv_invpro, inv_sts_ppn, inv_ppn, inv_disc, inv_pph, date_create, user_create
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
                [invNomor, divisi.substring(0, 1), tanggal, keterangan, kodePerush,
                    cusKode, alamatCus, tglTempo, rekening, invPro, isPpnInt, ppnValue, diskon, pph, currentUser]
            );
        }

        for (const [index, item] of detail.entries()) {
            if (!item.spk_nomor) continue;

            await connection.query(
                `INSERT INTO tinv_dtl (
          invd_inv_nomor, invd_sj_nomor, invd_spk_nomor, invd_ukuran, 
          invd_jumlah, invd_harga, invd_nourut
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [invNomor, item.sj_nomor, item.spk_nomor, item.ukuran,
                    item.jumlah, item.harga, index + 1]
            );

            // Update Surat Jalan & Auto Approval (Logic Delphi)
            if (item.sj_nomor) {
                const sjList = item.sj_nomor.split(',');
                for (const sjNo of sjList) {
                    const cleanSj = sjNo.trim();
                    await connection.query(
                        `UPDATE tsj_hdr SET sj_approve = 1, sj_inv_nomor = ? WHERE sj_nomor = ?`,
                        [invNomor, cleanSj]
                    );

                    // Logic Approval Otomatis Berdasarkan Tanggal Cut-off (24/08/2020)
                    const [sjData] = await connection.query(
                        `SELECT h.sj_gdg_kode, d.SJD_Jumlah, h.date_create 
             FROM tsj_hdr h INNER JOIN tsj_dtl d ON d.SJD_SJ_Nomor = h.SJ_Nomor 
             WHERE d.SJD_SPK_Nomor = ? AND h.SJ_Nomor = ?`,
                        [item.spk_nomor, cleanSj]
                    );

                    if (sjData.length > 0 && new Date(sjData[0].date_create) >= new Date('2020-08-24')) {
                        await connection.query(
                            `INSERT IGNORE INTO tsj_approve (sja_nomor, sja_spk_nomor, sja_jumlah, sja_gdg_kode) 
                VALUES (?, ?, ?, ?)`,
                            [cleanSj, item.spk_nomor, sjData[0].SJD_Jumlah, sjData[0].sj_gdg_kode]
                        );
                    }
                }
            }
        }

        await connection.commit();
        return { Nomor: invNomor };
    } catch (error) {
        await connection.rollback();
        throwDbError("Gagal menyimpan data Invoice", error);
    } finally {
        connection.release();
    }
};

const getInvoiceForPrint = async (nomor) => {
    const inv = await getInvoiceById(nomor);
    if (!inv) throw new Error("Invoice tidak ditemukan.");

    // Hitung Totals
    const subTotal = inv.Detail.reduce((sum, d) => sum + (parseFloat(d.total) || 0), 0);
    const totalNet = subTotal - parseFloat(inv.inv_disc || 0);

    let ppnAmount = 0;
    if (inv.inv_sts_ppn === 1) {
        // Logic PPh vs Normal PPN sesuai Delphi
        if (inv.inv_pph === "PPh") {
            ppnAmount = subTotal * (parseFloat(inv.inv_ppn) / 100);
        } else {
            ppnAmount = totalNet * (parseFloat(inv.inv_ppn) / 100);
        }
    }

    return {
        Header: {
            ...inv,
            SubTotal: subTotal,
            PpnAmount: ppnAmount,
            GrandTotal: totalNet + ppnAmount,
            TanggalFormat: format(new Date(inv.inv_tanggal), 'dd/MM/yyyy')
        },
        Detail: inv.Detail
    };
};

module.exports = {
    getInvoiceById,
    saveInvoice,
    getInvoiceForPrint,
    getNextInvoiceNumber
};