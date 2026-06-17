const pool = require('../config/db.config');
const { format } = require('date-fns');


const throwDbError = (message, error) => { throw new Error(message + ': ' + error.message); };

exports.getNewNomorMutasi = async () => {
    const PREFIX = 'MMT.MUT';
    try {
        const currentYYMM = format(new Date(), 'yyMM');
        const searchPattern = `${PREFIX}.${currentYYMM}.%`;

        const sql = `
            SELECT MAX(mut_nomor) AS MaxNomor 
            FROM tmutasi_hdr_mmt 
            WHERE mut_nomor LIKE ?;
        `;

        const [results] = await pool.query(sql, [searchPattern]);
        const maxNomor = results[0].MaxNomor;

        let newNumber = '0001';
        if (maxNomor) {
            const lastNumberString = maxNomor.substring(maxNomor.lastIndexOf('.') + 1);
            newNumber = (parseInt(lastNumberString, 10) + 1).toString().padStart(4, '0');
        }
        return `${PREFIX}.${currentYYMM}.${newNumber}`;
    } catch (error) {
        throw new Error('Gagal generate nomor mutasi: ' + error.message);
    }
};

exports.saveMutasiGudang = async (data, isUpdate = false, userLogin) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let { 
            Nomor, Tanggal, GudangAsal, GudangTujuan, 
            Keterangan, Type, Details 
        } = data;

        const serverTime = new Date();
        const activeUser = userLogin || 'SYSTEM';

        // 1. Handle Nomor Dokumen
        if (!isUpdate && (!Nomor || Nomor === 'AUTO')) {
            Nomor = await exports.getNewNomorMutasi();
        }

        if (isUpdate) {
            // 2. Update Header
            await connection.query(
                `UPDATE tmutasi_hdr_mmt SET 
                    mut_tanggal=?, mut_gdg_asal=?, mut_gdg_tujuan=?, 
                    mut_keterangan=?, mut_type=?, user_modified=?, date_modified=? 
                 WHERE mut_nomor=?`,
                [Tanggal, GudangAsal, GudangTujuan, Keterangan, Type, activeUser, serverTime, Nomor]
            );

            // JIKA UPDATE: Bersihkan data lama
            await connection.query('DELETE FROM tmutasi_dtl_mmt WHERE mutd_mut_nomor = ?', [Nomor]);
            await connection.query('DELETE FROM tmasterstok_bahan WHERE mst_noreferensi = ?', [Nomor]);
            await connection.query('DELETE FROM tmasterstok_mmt WHERE mst_noreferensi = ?', [Nomor]);
        } else {
            // 2. Insert Header
            await connection.query(
                `INSERT INTO tmutasi_hdr_mmt 
                    (mut_nomor, mut_tanggal, mut_gdg_asal, mut_gdg_tujuan, mut_keterangan, mut_type, user_create, date_create) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [Nomor, Tanggal, GudangAsal, GudangTujuan, Keterangan, Type, activeUser, serverTime]
            );
        }

        // 3. Insert Details & Handle Kartu Stok (tmasterstok)
        if (Details && Details.length > 0) {
            
            // =========================================================================
            // PERBAIKAN UTAMA: Grouping data detail jika kode_barang sama (Khusus / Umum)
            // =========================================================================
            const groupedDetailsMap = new Map();

            for (const d of Details) {
                const key = `${d.kode_barang}_${d.expired || 'null'}`;
                if (groupedDetailsMap.has(key)) {
                    const existing = groupedDetailsMap.get(key);
                    // Tambahkan QTY nya (di-count akumulasi)
                    existing.qty += Number(d.qty);
                    // Untuk keterangan atau barcode, gabungkan dengan koma jika berbeda
                    if (d.barcode && !existing.barcode.includes(d.barcode)) {
                        existing.barcode += `, ${d.barcode}`;
                    }
                } else {
                    // Jika belum ada, masukkan data baru (clone agar tidak merubah data asli klien)
                    groupedDetailsMap.set(key, { ...d, qty: Number(d.qty) });
                }
            }

            // Ubah kembali Map hasil grouping menjadi Array untuk diproses query
            const finalDetails = Array.from(groupedDetailsMap.values());
            // =========================================================================

            // Siapkan bulk values untuk tmutasi_dtl_mmt berdasarkan data yang sudah di-group
            const detailValues = finalDetails.map((d, index) => [
                Nomor,              // mutd_mut_nomor (PK)
                d.kode_barang,      // mutd_brg_kode (PK)
                d.qty,              // mutd_qty (Sudah terakumulasi)
                d.expired || null,  // mutd_expired (PK)
                d.keterangan || '', // mutd_keterangan
                d.nourut || (index + 1), // mutd_nourut
                GudangAsal          // mutd_gdg_kode
            ]);

            // Insert ke detail mutasi (Aman dari duplicate entry)
            await connection.query(
                `INSERT INTO tmutasi_dtl_mmt 
                    (mutd_mut_nomor, mutd_brg_kode, mutd_qty, mutd_expired, mutd_keterangan, mutd_nourut, mutd_gdg_kode) 
                 VALUES ?`, [detailValues]
            );

            // --- LOGIKA KARTU STOK OTOMATIS MENGGUNAKAN DATA YANG SUDAH DI-GROUP ---
            for (const item of finalDetails) {
                
                // A. KONDISI MASUK KE TABEL BARU (tmasterstok_bahan) JIKA TUJUAN KE 'GB001'
                if (GudangTujuan === 'GB001') {
                    await connection.query(
                        `INSERT INTO tmasterstok_bahan 
                            (mst_gdg_kode, mst_noreferensi, mst_brg_kode, mst_tanggal, mst_stok_in, mst_stok_out, mst_hargabeli, date_create, mst_aktif)
                         VALUES (?, ?, ?, ?, ?, 0, 0, ?, 'Y')
                         ON DUPLICATE KEY UPDATE 
                            mst_tanggal = VALUES(mst_tanggal),
                            mst_stok_in = VALUES(mst_stok_in),
                            date_create = VALUES(date_create),
                            mst_aktif = 'Y'`,
                        ['GB001', Nomor, item.kode_barang, Tanggal, item.qty, serverTime]
                    );
                }

                // B. KONDISI POTONG STOK (OUT) DI GUDANG ASAL (tmasterstok_mmt)
                await connection.query(
                    `INSERT INTO tmasterstok_mmt 
                        (mst_gdg_kode, mst_noreferensi, mst_brg_kode, mst_barcode, mst_tanggal, mst_stok_in, mst_stok_out, date_create)
                     VALUES (?, ?, ?, ?, ?, 0, ?, ?)
                     ON DUPLICATE KEY UPDATE 
                        mst_stok_out = VALUES(mst_stok_out),
                        mst_tanggal = VALUES(mst_tanggal),
                        mst_barcode = VALUES(mst_barcode)`,
                    [GudangAsal, Nomor, item.kode_barang, item.barcode || '', Tanggal, item.qty, serverTime]
                );
            }
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

exports.getMutasiData = async (startDate, endDate) => {
    try {
        const sqlMaster = `
            SELECT 
                h.mut_nomor AS Nomor,
                h.mut_tanggal AS Tanggal,
                h.mut_gdg_asal AS Asal,
                h.mut_gdg_tujuan AS Tujuan,
                h.mut_keterangan AS Keterangan,
                h.mut_status_realisasi AS Status
            FROM tmutasi_hdr_mmt h
            WHERE h.mut_tanggal BETWEEN ? AND ?
            ORDER BY h.mut_tanggal DESC
        `;

        const [masterResults] = await pool.query(sqlMaster, [startDate, endDate]);
        if (masterResults.length === 0) return [];

        const nomors = masterResults.map(r => r.Nomor);
        const [detailResults] = await pool.query(
            `SELECT 
                d.mutd_mut_nomor AS Nomor, d.mutd_brg_kode AS Kode, 
                b.brg_nama AS Nama_Barang, d.mutd_qty AS Qty, 
                d.mutd_expired AS Expired, d.mutd_keterangan AS Ket
             FROM tmutasi_dtl_mmt d
             LEFT JOIN tbarang_mmt b ON d.mutd_brg_kode = b.brg_kode
             WHERE d.mutd_mut_nomor IN (?)`, [nomors]
        );

        // Mapping detail ke dalam master
        return masterResults.map(header => ({
            ...header,
            Details: detailResults.filter(d => d.Nomor === header.Nomor)
        }));

    } catch (error) {
        throw new Error('Gagal tarik data mutasi: ' + error.message);
    }
};