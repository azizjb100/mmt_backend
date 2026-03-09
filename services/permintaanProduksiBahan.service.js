// backend/src/services/permintaanProduksiBahan.service.js

const pool = require('../config/db.config');
const { format } = require('date-fns');

const throwDbError = (message, error) => { throw new Error(message + ': ' + error.message); };

// ===================================
// 1. READ (Browse & Detail)
// ===================================
// Konfigurasi Mapping Tabel yang Diperbaiki
const TABLE_CONFIG = {
    MMT: {
        hdr: 'tpermintaan_prod_hdr',
        dtl: 'tpermintaan_prod_dtl',
        prefix: 'MNT',
        fields: {
            h: ['mnt_nomor', 'mnt_tanggal', 'mnt_gdg_kode', 'mnt_keterangan', 'mnt_lokasiproduksi'],
            d: ['mntd_mnt_nomor', 'mntd_brg_kode', 'mntd_qty', 'mntd_brg_satuan', 'mntd_keterangan', 'mntd_spk_nomor', 'mntd_nourut']
        }
    },
    OBAT: {
        hdr: 'tobatminta_hdr',
        dtl: 'tobatminta_dtl',
        prefix: 'MIO',
        fields: {
            h: ['min_nomor', 'min_tanggal', 'min_gp', 'min_ket', 'min_cab'],
            // SESUAI GAMBAR: mind_urut dan mind_spk
            d: ['mind_nomor', 'mind_o_kode', 'mind_jumlah', 'mind_ket', 'mind_urut', 'mind_satuan', 'mind_spk']
        }
    }
};

// ===================================
// 1. GENERATE NOMOR (Dinamis MMT/OBAT)
// ===================================
exports.getNewNomor = async (tipe = 'MMT') => {
    const conf = TABLE_CONFIG[tipe] || TABLE_CONFIG.MMT;
    
    try {
        // 1. Gunakan format YYMM (4 digit) sesuai permintaan Anda: MNT-2603
        const currentYYMM = format(new Date(), 'yyMM'); 

        // 2. Buat pattern pencarian: MNT-2603-%
        const pattern = `${conf.prefix}-${currentYYMM}-%`;
        const fieldNomor = conf.fields.h[0];
        
        // 3. Cari nomor tertinggi dengan pattern tersebut
        const sql = `SELECT MAX(${fieldNomor}) AS MaxNomor FROM ${conf.hdr} WHERE ${fieldNomor} LIKE ?;`;
        const [results] = await pool.query(sql, [pattern]);
        
        const maxNomor = results[0].MaxNomor;
        let nextNum = 1;

        // 4. Jika ditemukan, ambil angka terakhir dan tambah 1
        if (maxNomor) {
            const parts = maxNomor.split('-');
            const lastPart = parts[parts.length - 1]; // Mengambil bagian angka paling belakang (0001)
            nextNum = parseInt(lastPart, 10) + 1;
        }

        // 5. Formatting angka (0001 untuk MMT, 00001 untuk OBAT)
        const padSize = tipe === 'OBAT' ? 5 : 4;
        const formattedNum = nextNum.toString().padStart(padSize, '0');
        
        // 6. Return dengan format: PREFIX-YYMM-COUNTER
        // Contoh: MNT-2603-0001
        return `${conf.prefix}-${currentYYMM}-${formattedNum}`;
            
    } catch (error) {
        throw new Error('Gagal mendapatkan nomor baru: ' + error.message);
    }
};

// ===================================
// 2. SAVE / UPDATE (Dinamis)
// ===================================
// backend/src/services/permintaanProduksiBahan.service.js

exports.savePermintaanProduksi = async (data, isUpdate = false) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        // 1. Logika Pemisahan Eksklusif:
        // Jika WH-20, paksa pakai tipe OBAT. Selain itu paksa pakai tipe MMT.
        const tipe = data.GudangKode === 'WH-20' ? 'OBAT' : 'MMT';
        const conf = TABLE_CONFIG[tipe];
        const f = conf.fields;

        let { Nomor, Tanggal, Departemen, Keterangan, Details, User, GudangKode } = data;

        // 2. Generate Nomor Baru sesuai tipe jika data baru
        if (!isUpdate && (!Nomor || Nomor === 'AUTO')) {
            Nomor = await exports.getNewNomor(tipe);
        }

        // 3. Simpan Header ke tabel yang sesuai (MMT atau OBAT saja)
        if (isUpdate) {
            const sqlUpdate = `UPDATE ${conf.hdr} SET 
                ${f.h[1]}=?, ${f.h[3]}=?, ${f.h[4]}=?, ${f.h[2]}=?, 
                user_modified=?, date_modified=NOW() WHERE ${f.h[0]}=?`;
            await connection.query(sqlUpdate, [Tanggal, Keterangan, Departemen, GudangKode, User, Nomor]);
            
            // Hapus detail lama sebelum insert ulang
            await connection.query(`DELETE FROM ${conf.dtl} WHERE ${f.d[0]} = ?`, [Nomor]);
        } else {
            const sqlInsert = `INSERT INTO ${conf.hdr} 
                (${f.h[0]}, ${f.h[1]}, ${f.h[2]}, ${f.h[3]}, ${f.h[4]}, user_create, date_create) 
                VALUES (?, ?, ?, ?, ?, ?, NOW())`;
            await connection.query(sqlInsert, [Nomor, Tanggal, GudangKode, Keterangan, Departemen, User]);
        }

        // 4. Simpan Detail ke tabel yang sesuai
        if (Details && Details.length > 0) {
            const detailValues = Details.map((d, index) => {
                if (tipe === 'MMT') {
                    // Mapping MMT: Nomor, Kode, Qty, Satuan, Ket, SPK, Urut
                    return [Nomor, d.sku, d.qtyMinta, d.satuan, d.keterangan || '', d.spk || '', index + 1];
                } else {
                    // Mapping OBAT: mind_nomor, mind_o_kode, mind_jumlah, mind_ket, mind_urut, mind_satuan, mind_spk
                    return [
                        Nomor, 
                        d.sku, 
                        d.qtyMinta, 
                        d.keterangan || '', 
                        index + 1, 
                        d.satuan || '', 
                        d.spk ? parseInt(d.spk) : 0 
                    ];
                }
            });

            const sqlInsertDtl = `INSERT INTO ${conf.dtl} 
                (${f.d.join(',')}) 
                VALUES ?`;
            await connection.query(sqlInsertDtl, [detailValues]);
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

// ===================================
// 3. READ (Detail by Nomor)
// ===================================
exports.getPermintaanProduksiDataByNomor = async (nomor) => {
    try {
        const tipe = nomor.startsWith('MIO') ? 'OBAT' : 'MMT';
        const conf = TABLE_CONFIG[tipe];
        const f = conf.fields;

        // 1. Ambil Header
        const sqlHeader = `
            SELECT
                ${f.h[0]} AS Nomor, 
                ${f.h[2]} AS Gudang, 
                -- Tambahkan Join ke master gudang jika perlu Nama Gudang
                DATE_FORMAT(${f.h[1]}, '%d-%m-%Y') AS Tanggal, 
                ${f.h[3]} AS Keterangan
            FROM ${conf.hdr} WHERE ${f.h[0]} = ?;
        `;
        const [header] = await pool.query(sqlHeader, [nomor]);
        if (header.length === 0) return null;

        // 2. Ambil Detail (SESUAIKAN DENGAN FRONTEND)
        // Frontend butuh: Nomor, Kode, Nama_Bahan, Panjang, Lebar, Satuan, Jumlah, dll
        let sqlDetail = "";
        if (tipe === 'MMT') {
            sqlDetail = `
                SELECT
                    d.${f.d[0]} AS Nomor,
                    d.${f.d[1]} AS Kode, 
                    b.brg_nama AS Nama_Bahan, -- Pastikan join ke tabel barang
                    0 AS Panjang, -- Jika tidak ada di DB, default 0 agar tidak error toFixed
                    0 AS Lebar,
                    d.${f.d[3]} AS Satuan,
                    d.${f.d[2]} AS Jumlah, 
                    '' AS Operator,
                    d.${f.d[5]} AS Nomor_SPK,
                    d.${f.d[4]} AS Keterangan
                FROM ${conf.dtl} d
                LEFT JOIN tbarang b ON d.${f.d[1]} = b.brg_kode
                WHERE d.${f.d[0]} = ?
                ORDER BY d.${f.d[6]};
            `;
        } else {
            sqlDetail = `
                SELECT
                    d.${f.d[0]} AS Nomor,
                    d.${f.d[1]} AS Kode, 
                    o.o_nama AS Nama_Bahan,
                    0 AS Panjang,
                    0 AS Lebar,
                    d.${f.d[5]} AS Satuan,
                    d.${f.d[2]} AS Jumlah, 
                    '' AS Operator,
                    d.${f.d[6]} AS Nomor_SPK,
                    d.${f.d[3]} AS Keterangan
                FROM ${conf.dtl} d
                LEFT JOIN tobat o ON d.${f.d[1]} = o.o_kode
                WHERE d.${f.d[0]} = ?
                ORDER BY d.${f.d[4]};
            `;
        }

        const [details] = await pool.query(sqlDetail, [nomor]);
        return { ...header[0], Detail: details }; // Pastikan key-nya 'Detail' (Capital D) sesuai Frontend
    } catch (error) {
        throw new Error('Gagal ambil detail: ' + error.message);
    }
};
// ===================================
// 4. DELETE
// ===================================
exports.deletePermintaanProduksi = async (nomor) => {
    const connection = await pool.getConnection();
    try {
        const tipe = nomor.startsWith('MIO') ? 'OBAT' : 'MMT';
        const conf = TABLE_CONFIG[tipe];

        await connection.beginTransaction();
        await connection.query(`DELETE FROM ${conf.dtl} WHERE ${conf.fields.d_nomor} = ?`, [nomor]);
        const [result] = await connection.query(`DELETE FROM ${conf.hdr} WHERE ${conf.fields.h_nomor} = ?`, [nomor]);
        await connection.commit();
        return result.affectedRows > 0;
    } catch (error) {
        await connection.rollback();
        throwDbError('Gagal hapus data', error);
    } finally {
        connection.release();
    }
};

// ===================================
// 5. READ (Browse)
// ===================================
// backend/src/services/permintaanProduksiBahan.service.js


exports.getPermintaanProduksiData = async (startDate, endDate, userDivisi) => {
    try {
        let sql = "";
        let params = [];
        
        // Pastikan userDivisi dikonversi ke Number untuk perbandingan yang akurat
        const divisi = userDivisi ? Number(userDivisi) : null;

        // LOGIKA FILTER TABEL BERDASARKAN DIVISI USER
        if (divisi === 4) {
            sql = `
                SELECT
                    h.min_nomor AS Nomor, 
                    h.min_gp AS Gudang, 
                    DATE_FORMAT(h.min_tanggal, '%d-%m-%Y') AS Tanggal, 
                    h.min_ket AS Keterangan, 
                    h.min_cab AS Lokasi,
                    'OPEN' AS Status,
                    'OBAT' AS Tipe
                FROM tobatminta_hdr h
                WHERE h.min_tanggal BETWEEN ? AND ?
                ORDER BY h.min_tanggal DESC;
            `;
            params = [startDate, endDate];
        } 
        else if (divisi === 1) {
            // KHUSUS DIVISI 1: Ambil data dari tabel MMT (tpermintaan_prod_hdr)
            sql = `
                SELECT
                    h.mnt_nomor AS Nomor, 
                    h.mnt_gdg_kode AS Gudang, 
                    DATE_FORMAT(h.mnt_tanggal, '%d-%m-%Y') AS Tanggal, 
                    h.mnt_keterangan AS Keterangan, 
                    h.mnt_status AS Status,
                    'MMT' AS Tipe
                FROM tpermintaan_prod_hdr h
                WHERE h.mnt_tanggal BETWEEN ? AND ?
                ORDER BY h.mnt_tanggal DESC;
            `;
            params = [startDate, endDate];
        } 
        else {
            // ADMIN / DIVISI LAIN: Tampilkan gabungan MMT dan OBAT
            sql = `
                SELECT mnt_nomor AS Nomor, mnt_gdg_kode AS Gudang, DATE_FORMAT(mnt_tanggal, '%d-%m-%Y') AS Tanggal, 
                       mnt_keterangan AS Keterangan, mnt_lokasiproduksi AS Lokasi, mnt_status AS Status, 'MMT' AS Tipe
                FROM tpermintaan_prod_hdr WHERE mnt_tanggal BETWEEN ? AND ?
                UNION ALL
                SELECT min_nomor AS Nomor, min_gp AS Gudang, DATE_FORMAT(min_tanggal, '%d-%m-%Y') AS Tanggal, 
                       min_ket AS Keterangan, min_cab AS Lokasi, 'OPEN' AS Status, 'OBAT' AS Tipe
                FROM tobatminta_hdr WHERE min_tanggal BETWEEN ? AND ?
                ORDER BY Tanggal DESC;
            `;
            params = [startDate, endDate, startDate, endDate];
        }

        const [results] = await pool.query(sql, params);
        return results;
    } catch (error) {
        throw new Error('Gagal mengambil data permintaan: ' + error.message);
    }
};

// exports.getNewNomor = async () => {
//     const NOMERATOR = 'MNT';
//     try {
//         const currentYYMM = format(new Date(), 'yyMMdd'); 
//         const searchPattern = `${NOMERATOR}-${currentYYMM}-%`;

//         const sql = `SELECT MAX(mnt_nomor) AS MaxNomor FROM tpermintaan_prod_hdr WHERE mnt_nomor LIKE ?;`;
//         const [results] = await pool.query(sql, [searchPattern]);

//         const maxNomor = results[0].MaxNomor;
//         let newNumber = '0001';

//         if (maxNomor) {
//             const lastNumberString = maxNomor.split('-').pop();
//             const lastNumber = parseInt(lastNumberString, 10);
//             newNumber = (lastNumber + 1).toString().padStart(4, '0');
//         }

//         return `${NOMERATOR}-${currentYYMM}-${newNumber}`;
//     } catch (error) {
//         throwDbError('Gagal mendapatkan nomor dokumen baru', error);
//     }
// };

// // ===================================
// // 3. SAVE / UPDATE (cxButton1Click)
// // ===================================

// exports.savePermintaanProduksi = async (data, isUpdate = false) => {
//     const connection = await pool.getConnection();
//     try {
//         await connection.beginTransaction();
        
//         // Tambahkan GudangKode ke dalam destrukturisasi data
//         let { Nomor, Tanggal, Departemen, Keterangan, Details, User, GudangKode } = data;

//         if (!isUpdate && (!Nomor || Nomor === 'AUTO')) {
//             Nomor = await exports.getNewNomor();
//         }

//         if (isUpdate) {
//             await connection.query(
//                 `UPDATE tpermintaan_prod_hdr 
//                  SET mnt_tanggal=?, 
//                      mnt_keterangan=?, 
//                      mnt_lokasiproduksi=?, 
//                      mnt_gdg_kode=?, -- Tambahkan update gudang jika diizinkan
//                      user_modified=?, 
//                      date_modified=NOW() 
//                  WHERE mnt_nomor=?`,
//                 [Tanggal, Keterangan, Departemen, GudangKode, User, Nomor]
//             );
//             await connection.query('DELETE FROM tpermintaan_prod_dtl WHERE mntd_mnt_nomor = ?', [Nomor]);
//         } else {
//             await connection.query(
//                 `INSERT INTO tpermintaan_prod_hdr 
//                 (mnt_nomor, mnt_tanggal, mnt_gdg_kode, mnt_keterangan, mnt_lokasiproduksi, user_create, date_create) 
//                 VALUES (?, ?, ?, ?, ?, ?, NOW())`,
//                 // SEBELUMNYA: 'WH-16' diganti menjadi variabel GudangKode
//                 [Nomor, Tanggal, GudangKode, Keterangan, Departemen, User]
//             );
//         }

//         const detailValues = Details.map((d, index) => [
//             Nomor, d.spk || '', d.sku, d.satuan, d.qtyMinta, d.keterangan || '', index + 1
//         ]);

//         if (detailValues.length > 0) {
//             await connection.query(
//                 `INSERT INTO tpermintaan_prod_dtl 
//                 (mntd_mnt_nomor, mntd_spk_nomor, mntd_brg_kode, mntd_brg_satuan, mntd_qty, mntd_keterangan, mntd_nourut) 
//                 VALUES ?`,
//                 [detailValues]
//             );
//         }

//         await connection.commit();
//         return { success: true, nomor: Nomor };
//     } catch (error) {
//         await connection.rollback();
//         throw error;
//     } finally {
//         connection.release();
//     }
// };

// ===================================
// 4. DELETE
// ===================================

// exports.deletePermintaanProduksi = async (nomor) => {
//     const connection = await pool.getConnection();
//     try {
//         await connection.beginTransaction();
//         await connection.query('DELETE FROM tpermintaan_prod_dtl WHERE mntd_mnt_nomor = ?', [nomor]);
//         const [result] = await connection.query('DELETE FROM tpermintaan_prod_hdr WHERE mnt_nomor = ?', [nomor]);
//         await connection.commit();
//         return result.affectedRows > 0;
//     } catch (error) {
//         await connection.rollback();
//         throwDbError('Gagal menghapus data', error);
//     } finally {
//         connection.release();
//     }
// };

// backend/services/permintaan.service.js

exports.lookupPermintaanProduksi = async (search = '', userDivisi) => {
    try {
        const pattern = `%${search}%`;
        let sql = "";
        let params = [];

        // Pastikan userDivisi dikonversi ke Number agar perbandingan aman
        const divisi = userDivisi ? Number(userDivisi) : null;

        // LOGIKA PEMISAHAN TABEL BERDASARKAN DIVISI
        if (divisi === 4) {
            // KHUSUS DIVISI 4: Ambil dari tabel OBAT (tobatminta_hdr)
            sql = `
                SELECT 
                    h.min_nomor AS Nomor, 
                    DATE_FORMAT(h.min_tanggal, '%d-%m-%Y') AS Tanggal, 
                    h.min_cab AS Lokasi,
                    h.min_gp AS Gudang,
                    h.min_ket AS Keterangan,
                    'OPEN' AS Status
                FROM tobatminta_hdr h
                WHERE (h.min_nomor LIKE ? OR h.min_ket LIKE ?)
                ORDER BY h.min_tanggal DESC 
                LIMIT 50;
            `;
            params = [pattern, pattern];
        } else if (divisi === 1) {
            // KHUSUS DIVISI 1: Ambil dari tabel MMT (tpermintaan_prod_hdr)
            sql = `
                SELECT 
                    h.mnt_nomor AS Nomor, 
                    DATE_FORMAT(h.mnt_tanggal, '%d-%m-%Y') AS Tanggal, 
                    h.mnt_lokasiproduksi AS Lokasi,
                    h.mnt_gdg_kode AS Gudang,
                    h.mnt_keterangan AS Keterangan,
                    h.mnt_status AS Status
                FROM tpermintaan_prod_hdr h
                WHERE (h.mnt_nomor LIKE ? OR h.mnt_keterangan LIKE ?)
                AND h.mnt_gdg_kode = 'WH-16'
                ORDER BY h.mnt_tanggal DESC 
                LIMIT 50;
            `;
            params = [pattern, pattern];
        } else {
            // ADMIN / LAINNYA: Tampilkan gabungan (UNION ALL)
            sql = `
                SELECT mnt_nomor AS Nomor, DATE_FORMAT(mnt_tanggal, '%d-%m-%Y') AS Tanggal, mnt_lokasiproduksi AS Lokasi, mnt_gdg_kode AS Gudang, mnt_keterangan AS Keterangan, mnt_status AS Status
                FROM tpermintaan_prod_hdr WHERE (mnt_nomor LIKE ? OR mnt_keterangan LIKE ?)
                UNION ALL
                SELECT min_nomor AS Nomor, DATE_FORMAT(min_tanggal, '%d-%m-%Y') AS Tanggal, min_cab AS Lokasi, min_gp AS Gudang, min_ket AS Keterangan, 'OPEN' AS Status
                FROM tobatminta_hdr WHERE (min_nomor LIKE ? OR min_ket LIKE ?)
                ORDER BY Tanggal DESC 
                LIMIT 50;
            `;
            params = [pattern, pattern, pattern, pattern];
        }

        const [results] = await pool.query(sql, params);
        return results;
    } catch (error) {
        throw new Error('Gagal mengambil lookup daftar permintaan: ' + error.message);
    }
};