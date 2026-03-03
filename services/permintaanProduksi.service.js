// backend/src/services/permintaanProduksi.service.js

const pool = require('../config/db.config');
const { format } = require('date-fns');

// Helper untuk throw error (diasumsikan sudah didefinisikan)
const throwDbError = (message, error) => { throw new Error(message + ': ' + error.message); };


// exports.getStokByBarcode = async (barcode, gudangKode) => {
//     try {
//         const sql = `
//             SELECT 
//                 s.mst_barcode AS Barcode, 
//                 s.mst_brg_kode AS Kode, 
//                 TRIM(b.brg_nama) AS Nama_Bahan, 
//                 b.brg_satuan AS Satuan, 
//                 s.mst_panjang AS Panjang, 
//                 s.mst_lebar AS Lebar,
//                 s.mst_spk_nomor AS Nomor_SPK,
//                 -- Menghitung total saldo stok dari semua baris di gudang tersebut
//                 SUM(s.mst_stok_in - s.mst_stok_out) AS Stok
//             FROM tmasterstok_mmt s
//             LEFT JOIN tbarang_mmt b ON s.mst_brg_kode = b.brg_kode
//             WHERE s.mst_barcode = ? 
//               AND s.mst_gdg_kode = ?
//             GROUP BY 
//                 s.mst_barcode, s.mst_brg_kode, b.brg_nama, 
//                 b.brg_satuan, s.mst_panjang, s.mst_lebar, s.mst_spk_nomor
//             -- Filter hasil akhir: hanya tampilkan jika total stok > 0
//             HAVING Stok > 0;
//         `;

//         const [results] = await pool.query(sql, [barcode, gudangKode]);
        
//         // Jika saldo akhir 0 atau negatif, results akan kosong []
//         return results[0] || null;
//     } catch (error) {
//         throwDbError('Gagal mencari data barcode', error);
//     }
// };

exports.getStokByBarcode = async (barcode, gudangKode) => {
    try {
        // --- LANGKAH 1: Coba cari di tabel MMT dulu ---
        const sqlMMT = `
            SELECT 
                m.mst_barcode AS Barcode, 
                m.mst_brg_kode AS Kode, 
                TRIM(b.brg_nama) AS Nama_Bahan, 
                b.brg_satuan AS Satuan, 
                ROUND(SUM(COALESCE(m.mst_stok_in, 0) * m.mst_panjang) - SUM(COALESCE(m.mst_stok_out, 0) * m.mst_panjang), 3) AS Panjang, 
                MAX(m.mst_lebar) AS Lebar,
                MAX(m.mst_spk_nomor) AS Nomor_SPK,
                SUM(COALESCE(m.mst_stok_in, 0) - COALESCE(m.mst_stok_out, 0)) AS Stok
            FROM tmasterstok_mmt m
            LEFT JOIN tbarang_mmt b ON m.mst_brg_kode = b.brg_kode
            WHERE m.mst_barcode = ? AND m.mst_gdg_kode = ?
            GROUP BY m.mst_barcode, m.mst_brg_kode, b.brg_nama, b.brg_satuan
            HAVING Stok > 0;
        `;

        const [resultsMMT] = await pool.query(sqlMMT, [barcode, gudangKode]);

        // Jika ketemu di MMT, langsung kembalikan datanya
        if (resultsMMT.length > 0) {
            return resultsMMT[0];
        }

        // --- LANGKAH 2: Jika tidak ketemu di MMT DAN gudangnya WH-20, cari di tabel OBAT ---
        if (gudangKode === 'WH-20') {
            const sqlObat = `
                SELECT 
                    m.mst_barcode AS Barcode, 
                    m.mst_brg_kode AS Kode, 
                    TRIM(b.o_nama) AS Nama_Bahan, 
                    b.o_satuan AS Satuan, 
                    ROUND(SUM(COALESCE(m.mst_stok_in, 0) * m.mst_panjang) - SUM(COALESCE(m.mst_stok_out, 0) * m.mst_panjang), 3) AS Panjang, 
                    MAX(m.mst_lebar) AS Lebar,
                    MAX(m.mst_spk_nomor) AS Nomor_SPK,
                    SUM(COALESCE(m.mst_stok_in, 0) - COALESCE(m.mst_stok_out, 0)) AS Stok
                FROM tmasterstok_obat m
                LEFT JOIN tobat b ON m.mst_brg_kode = b.o_kode
                WHERE m.mst_barcode = ? AND m.mst_gdg_kode = ?
                GROUP BY m.mst_barcode, m.mst_brg_kode, b.o_nama, b.o_satuan
                HAVING Stok > 0;
            `;

            const [resultsObat] = await pool.query(sqlObat, [barcode, gudangKode]);
            return resultsObat[0] || null;
        }

        return null; // Benar-benar tidak ditemukan di manapun
    } catch (error) {
        throw new Error(`Gagal scan barcode: ${error.message}`);
    }
};

exports.getPermintaanProduksiData = async (startDate, endDate, userDivisi) => {
    try {
        // Logika penentuan gudang berdasarkan user_divisi
        let filterDivisi = "";
        
        if (userDivisi == 1) {
            // Role 1 hanya boleh melihat WH-16
            filterDivisi = "AND mnt_gdg_kode = 'WH-16'";
        } else if (userDivisi == 4) {
            // Role 4 hanya boleh melihat WH-20
            filterDivisi = "AND mnt_gdg_kode = 'WH-20'";
        } else {
            // Jika admin atau role lain, bisa melihat semua WH
            filterDivisi = "AND gdg_kode LIKE '%WH%'";
        }

        // Query SQL Master dengan Filter Divisi
        const sqlMaster = `
            SELECT
                mnt_nomor AS Nomor, mnt_gdg_kode AS Gudang, gdg_nama AS Nama,
                DATE_FORMAT(mnt_tanggal, '%d-%M-%Y') AS Tanggal, mnt_keterangan AS Keterangan
            FROM tminta_mmt_hdr
            LEFT JOIN tgudang ON gdg_kode = mnt_gdg_kode
            WHERE mnt_tanggal BETWEEN ? AND ?
                ${filterDivisi}
            GROUP BY mnt_nomor, mnt_gdg_kode, mnt_tanggal, mnt_keterangan
            ORDER BY mnt_tanggal DESC;
        `;

        const [masterResults] = await pool.query(sqlMaster, [startDate, endDate]);
        const masterNomors = masterResults.map(row => row.Nomor);
        
        if (masterNomors.length === 0) return [];

        // Query Detail tetap sama (menggunakan IN masterNomors yang sudah terfilter)
        const sqlDetail = `
            SELECT
                d.mntd_mnt_nomor AS Nomor, d.mntd_brg_kode AS Kode, d.mntd_barcode AS Barcode,
                TRIM(b.brg_nama) AS Nama_Bahan, d.mntd_qty AS Jumlah, d.mntd_brg_satuan AS Satuan,
                d.mntd_spk_nomor AS Nomor_SPK, d.mntd_keterangan AS Keterangan,
                MAX(s.mst_panjang) AS Panjang, MAX(s.mst_lebar) AS Lebar
            FROM tminta_mmt_dtl d
            LEFT JOIN tbarang_mmt b ON d.mntd_brg_kode = b.brg_kode
            LEFT JOIN tmasterstok_mmt s ON d.mntd_barcode = s.mst_barcode 
            WHERE d.mntd_mnt_nomor IN (?)
            GROUP BY d.mntd_mnt_nomor, d.mntd_nourut, d.mntd_brg_kode, d.mntd_barcode, b.brg_nama, d.mntd_qty, d.mntd_brg_satuan, d.mntd_spk_nomor, d.mntd_keterangan
            ORDER BY d.mntd_mnt_nomor, d.mntd_nourut;
        `;

        const [detailResults] = await pool.query(sqlDetail, [masterNomors]);

        // Mapping Data (Gunakan Map untuk efisiensi)
        const dataMap = new Map();
        masterResults.forEach(item => dataMap.set(item.Nomor, { ...item, Detail: [] }));
        detailResults.forEach(detail => {
            if (dataMap.has(detail.Nomor)) {
                dataMap.get(detail.Nomor).Detail.push(detail);
            }
        });

        return Array.from(dataMap.values());

    } catch (error) {
        throw new Error('Gagal mengambil data Permintaan: ' + error.message);
    }
};

// ===================================
// 2. DELETE (cxButton4Click)
// ===================================
exports.deletePermintaanProduksi = async (nomor) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Hapus Detail (tminta_mmt_dtl)
        await connection.query('DELETE FROM tminta_mmt_dtl WHERE mntd_mnt_nomor = ?', [nomor]);

        // 2. Hapus Header (tminta_mmt_hdr)
        const [result] = await connection.query('DELETE FROM tminta_mmt_hdr WHERE mnt_nomor = ?', [nomor]);

        await connection.commit();
        return result.affectedRows > 0;

    } catch (error) {
        await connection.rollback();
        throwDbError('Database Transaction Error on Delete', error);
    } finally {
        connection.release();
    }
};

// ===================================
// 5. GET MAX KODE (cxButton2Click -> getmaxkode)
// ===================================
exports.getNewNomor = async () => {
    // Definisi Nomerator/Prefiks sesuai permintaan Anda
    const NOMERATOR = 'MMT.MP';

    try {
        // 1. Dapatkan Tahun (2 digit) dan Bulan (2 digit) saat ini: YYMM
        const currentYYMM = format(new Date(), 'yyMM'); // Hasilnya: 2512

        // 2. Tentukan pola pencarian: MMT.MP.YYMM.%
        const searchPattern = `${NOMERATOR}.${currentYYMM}.%`;

        // 3. Query SQL: Mencari nomor tertinggi yang sudah ada untuk bulan ini
        const sql = `
            SELECT MAX(mnt_nomor) AS MaxNomor 
            FROM tminta_mmt_hdr 
            WHERE mnt_nomor LIKE ?;
        `;

        // Eksekusi query
        const [results] = await pool.query(sql, [searchPattern]);

        const maxNomor = results[0].MaxNomor;

        let newNumber = '0001';

        if (maxNomor) {
            // Ambil nomor urut terakhir dari string (misalnya '0045')
            const lastNumberString = maxNomor.substring(maxNomor.lastIndexOf('.') + 1);

            // Konversi ke integer dan tambahkan 1
            const lastNumber = parseInt(lastNumberString, 10);

            // Format kembali menjadi string 4 digit dengan leading zero
            newNumber = (lastNumber + 1).toString().padStart(4, '0');
        }
        return `${NOMERATOR}.${currentYYMM}.${newNumber}`;

    } catch (error) {
        throwDbError('Gagal mendapatkan nomor dokumen MMT.MP baru', error);
    }
};


exports.savePermintaanProduksi = async (data, isUpdate = false, userLogin) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Ambil properti langsung dari 'data' sesuai mapping di Controller
        let { Nomor, Gudang, Tanggal, Keterangan, Details, LokasiProduksi, Permintaan } = data;

        const serverTime = new Date();
        const activeUser = userLogin || 'SYSTEM';

        // Logika Nomor Otomatis
        if (!isUpdate && (!Nomor || Nomor === 'AUTO')) {
            Nomor = await exports.getNewNomor();
        }

        if (isUpdate) {
            await connection.query(
                `UPDATE tminta_mmt_hdr SET 
                    mnt_gdg_kode=?, 
                    mnt_lokasiproduksi=?, 
                    mnt_tanggal=?, 
                    mnt_keterangan=?, 
                    mnt_permintaan=?, 
                    user_modified=?, 
                    date_modified=? 
                WHERE mnt_nomor=?`,
                [Gudang, LokasiProduksi, Tanggal, Keterangan, Permintaan, activeUser, serverTime, Nomor]
            );
            await connection.query('DELETE FROM tminta_mmt_dtl WHERE mntd_mnt_nomor = ?', [Nomor]);
        } else {
            await connection.query(
                `INSERT INTO tminta_mmt_hdr 
                    (mnt_nomor, mnt_gdg_kode, mnt_lokasiproduksi, mnt_tanggal, mnt_keterangan, mnt_permintaan, user_create, date_create) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [Nomor, Gudang, LokasiProduksi, Tanggal, Keterangan, Permintaan, activeUser, serverTime]
            );
        }

        // Simpan Detail
        if (Details && Details.length > 0) {
            const detailValues = Details.map(d => [
                Nomor, 
                d.nourut, 
                d.sku, 
                d.qty, 
                d.satuan, 
                null, // operator
                d.spk || "0", 
                d.keterangan, 
                d.barcode
            ]);

            await connection.query(
                `INSERT INTO tminta_mmt_dtl 
                (mntd_mnt_nomor, mntd_nourut, mntd_brg_kode, mntd_qty, mntd_brg_satuan, mntd_operator, mntd_spk_nomor, mntd_keterangan, mntd_barcode) 
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