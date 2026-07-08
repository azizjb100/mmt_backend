const pool = require('../config/db.config');
const { format } = require('date-fns');

exports.getNewNomorMutasi = async () => {
    const PREFIX = 'MMT.MUT';
    try {
        const currentYYMM = format(new Date(), 'yyMM');
        const searchPattern = `${PREFIX}.${currentYYMM}.%`;

        const sql = `
            SELECT MAX(mut_nomor) AS MaxNomor 
            FROM tmutasi_hdr 
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

exports.saveMutasiInternal = async (data, isUpdate = false, userLogin) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let { 
            Nomor, Tanggal, GudangAsal, GudangTujuan, 
            Keterangan, Type, Details 
        } = data;

        // 🔍 PERBAIKAN: Jika GudangAsal dari frontend kosong, otomatis pakai 'GP001'
        const kodeGudangAsal = GudangAsal || 'GP001';
        const kodeGudangTujuan = GudangTujuan || 'GB001';

        const serverTime = new Date();
        const activeUser = userLogin || 'SYSTEM';

        // 1. Handle Nomor Dokumen
        if (!isUpdate && (!Nomor || Nomor === 'MUT-AUTO' || Nomor === 'AUTO')) {
            Nomor = await exports.getNewNomorMutasi();
        }

        if (isUpdate) {
            // JIKA UPDATE: Kembalikan (Restore) stok lrd_jumlah di detail LHK sebelum dihapus
            const [oldDetails] = await connection.query(
                'SELECT mutd_lhk_detail_id, mutd_nourut, mutd_jumlah FROM tmutasi_dtl WHERE mutd_mut_nomor = ?', 
                [Nomor]
            );
            for (const oldItem of oldDetails) {
                if (oldItem.mutd_lhk_detail_id) {
                    // Sesuai gambar: tabel dtl menggunakan lrd_jumlah, lrd_lr_nomor, dan lrd_no_urut
                    await connection.query(
                        'UPDATE tlhk_rtr_dtl SET lrd_jumlah = lrd_jumlah + ? WHERE lrd_lr_nomor = ? AND lrd_no_urut = ?',
                        [oldItem.mutd_jumlah, oldItem.mutd_lhk_detail_id, oldItem.mutd_nourut]
                    );
                }
            }

            // Clean-up data relasi lama
            await connection.query('DELETE FROM tmutasi_dtl WHERE mutd_mut_nomor = ?', [Nomor]);
            await connection.query('DELETE FROM tmasterstok_bahan WHERE mst_noreferensi = ?', [Nomor]);
            await connection.query('DELETE FROM tmasterstok_mmt WHERE mst_noreferensi = ?', [Nomor]);

            // 2. Update Header Mutasi
            await connection.query(
                `UPDATE tmutasi_hdr SET 
                    mut_tanggal=?, mut_gdg_asal=?, mut_gdg_tujuan=?, 
                    mut_keterangan=?, mut_type=?, user_modified=?, date_modified=? 
                 WHERE mut_nomor=?`,
                [Tanggal, kodeGudangAsal, kodeGudangTujuan, Keterangan, Type || 1, activeUser, serverTime, Nomor]
            );
        } else {
            // 2. Insert Header Baru Mutasi
            await connection.query(
                `INSERT INTO tmutasi_hdr 
                    (mut_nomor, mut_tanggal, mut_gdg_asal, mut_gdg_tujuan, mut_keterangan, mut_type, mut_status_realisasi, user_create, date_create) 
                 VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
                [Nomor, Tanggal, kodeGudangAsal, kodeGudangTujuan, Keterangan, Type || 1, activeUser, serverTime]
            );
        }

        // 3. Insert Details & Handle Kartu Stok
        if (Details && Details.length > 0) {
            
            // Grouping data detail jika kode barang & ID LHK sama untuk mencegah redundansi
            const groupedDetailsMap = new Map();

            for (const d of Details) {
                // Gunakan kombinasi kode barang, nomor LHK, dan nomor urut aslinya sebagai key grouping
                const key = `${d.brg_kode || d.kode_barang}_${d.lhk_detail_id || d.Nomor || 'null'}_${d.No_Urut || 0}`;
                if (groupedDetailsMap.has(key)) {
                    const existing = groupedDetailsMap.get(key);
                    existing.qty_mutasi += Number(d.qty_mutasi);
                } else {
                    groupedDetailsMap.set(key, { ...d, qty_mutasi: Number(d.qty_mutasi) });
                }
            }

            const finalDetails = Array.from(groupedDetailsMap.values());

            let noUrut = 1;
            for (const item of finalDetails) {
                const brgKode = item.brg_kode || item.kode_barang || '-';
                const lhkNomor = item.lhk_detail_id || item.Nomor; // Nomor LHK Master (lrd_lr_nomor)
                const lhkNoUrut = item.No_Urut || item.lrd_no_urut || 1; // Nomor urut baris di LHK dtl

                // Ambil snapshot stok lama berdasarkan kolom lrd_jumlah di tlhk_rtr_dtl
                const [stokCheck] = await connection.query(
                    "SELECT lrd_jumlah FROM tlhk_rtr_dtl WHERE lrd_lr_nomor = ? AND lrd_no_urut = ?", 
                    [lhkNomor, lhkNoUrut]
                );
                const currentStok = stokCheck[0]?.lrd_jumlah || 0;

                // Insert Detail ke tmutasi_dtl
                await connection.query(
                    `INSERT INTO tmutasi_dtl 
                        (mutd_mut_nomor, mutd_brg_kode, mutd_lhk_detail_id, mutd_spk_nomor, mutd_poi_nomor, mutd_poi_size, mutd_nama_komponen, mutd_jumlah, mutd_stok_sublim_lama, mutd_keterangan, mutd_nourut) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        Nomor, 
                        brgKode, 
                        lhkNomor, 
                        item.Nomor_SPK || item.nomor_spk || '-', 
                        item.No_PO_Internal || item.poi_nomor || '-', 
                        item.lrd_poid_size || item.poi_size || '', 
                        item.lrd_spk_nama || item.nama_komponen || '', 
                        item.qty_mutasi, 
                        currentStok, 
                        item.keterangan || '', 
                        noUrut++
                    ]
                );

                // Potong Qty/Jumlah di Log Kerja Sublim Detail (`lrd_jumlah`)
                await connection.query(
                    "UPDATE tlhk_rtr_dtl SET lrd_jumlah = lrd_jumlah - ? WHERE lrd_lr_nomor = ? AND lrd_no_urut = ?",
                    [item.qty_mutasi, lhkNomor, lhkNoUrut]
                );

                // Update flag `lr_mutasi` di tlhk_rtr_hdr menjadi 1 (Terisi/Sudah Mutasi)
                await connection.query(
                    "UPDATE tlhk_rtr_hdr SET lr_mutasi = 1 WHERE lr_nomor = ?",
                    [lhkNomor]
                );

              if (kodeGudangTujuan === 'GB001') {
                    await connection.query(
                        `INSERT INTO tmasterstok_bahan 
                            (mst_gdg_kode, mst_noreferensi, mst_brg_kode, mst_tanggal, mst_stok_in, mst_stok_out, mst_hargabeli, date_create, mst_aktif)
                        VALUES (?, ?, ?, ?, ?, 0, 0, ?, 'Y')
                        ON DUPLICATE KEY UPDATE mst_stok_in = mst_stok_in + VALUES(mst_stok_in)`,
                        ['GB001', Nomor, brgKode, Tanggal, item.qty_mutasi, serverTime]
                    );
                }

                // B. KONDISI KARTU STOK: KELUAR DARI GUDANG ASAL
                // Lakukan hal yang sama pada tmasterstok_mmt jika sewaktu-waktu mengalami duplicate entry
                await connection.query(
                    `INSERT INTO tmasterstok_mmt 
                        (mst_gdg_kode, mst_noreferensi, mst_brg_kode, mst_barcode, mst_tanggal, mst_stok_in, mst_stok_out, date_create)
                    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
                    ON DUPLICATE KEY UPDATE mst_stok_out = mst_stok_out + VALUES(mst_stok_out)`,
                    [kodeGudangAsal, Nomor, brgKode, item.barcode || '', Tanggal, item.qty_mutasi, serverTime]
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
                h.mut_nomor AS Nomor_Mutasi,
                h.mut_tanggal AS Tanggal,
                h.mut_gdg_asal AS Bagian_Asal,
                h.mut_gdg_tujuan AS Bagian_Tujuan,
                h.mut_keterangan AS Keterangan,
                h.mut_status_realisasi AS Status,
                COALESCE((SELECT SUM(mutd_jumlah) FROM tmutasi_dtl WHERE mutd_mut_nomor = h.mut_nomor), 0) AS Total_Qty
            FROM tmutasi_hdr h
            WHERE h.mut_tanggal BETWEEN ? AND ?
            ORDER BY h.date_create DESC
        `;

        const [masterResults] = await pool.query(sqlMaster, [startDate, endDate]);
        return masterResults;
    } catch (error) {
        throw new Error('Gagal tarik data master mutasi: ' + error.message);
    }
};

exports.getMutasiDetailByNomor = async (nomor) => {
    try {
        const sqlDetail = `
            SELECT 
                d.mutd_lhk_detail_id AS Lhk_Detail_Id,
                d.mutd_mut_nomor AS Nomor_Mutasi,
                d.mutd_spk_nomor AS Nomor_SPK,
                d.mutd_poi_nomor AS No_PO_Internal,
                d.mutd_poi_size AS Size,
                d.mutd_nama_komponen AS Nama_Komponen,
                d.mutd_jumlah AS Qty_Mutasi,
                d.mutd_stok_sublim_lama AS Stok_Sublim_Lama,
                s.Nama_SPK
            FROM tmutasi_dtl d
            LEFT JOIN trx_spk s ON d.mutd_spk_nomor = s.Nomor_SPK
            WHERE d.mutd_mut_nomor = ?
            ORDER BY d.mutd_nourut ASC
        `;
        const [detailResults] = await pool.query(sqlDetail, [nomor]);
        return detailResults;
    } catch (error) {
        throw new Error('Gagal tarik data detail mutasi: ' + error.message);
    }
};

exports.deleteMutasiGudang = async (nomor) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Ambil detail untuk pemulihan sisa stok LHK Sublim
        const [details] = await connection.query(
            'SELECT mutd_lhk_detail_id, mutd_jumlah FROM tmutasi_dtl WHERE mutd_mut_nomor = ?',
            [nomor]
        );

        // 2. Kembalikan sisa ke tabel LHK
        for (const item of details) {
            if (item.mutd_lhk_detail_id) {
                await connection.query(
                    'UPDATE tlhk_rtr_dtl SET lr_mutasi = lr_mutasi + ? WHERE Id = ?',
                    [item.mutd_jumlah, item.mutd_lhk_detail_id]
                );
            }
        }

        // 3. Hapus data di masterstok & mutasi (Hdr + Dtl)
        await connection.query('DELETE FROM tmasterstok_bahan WHERE mst_noreferensi = ?', [nomor]);
        await connection.query('DELETE FROM tmasterstok_mmt WHERE mst_noreferensi = ?', [nomor]);
        await connection.query('DELETE FROM tmutasi_dtl WHERE mutd_mut_nomor = ?', [nomor]);
        await connection.query('DELETE FROM tmutasi_hdr WHERE mut_nomor = ?', [nomor]);

        await connection.commit();
        return { success: true };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};