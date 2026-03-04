// backend/src/services/permintaanProduksi.service.js

const pool = require('../config/db.config');
const { format } = require('date-fns');

const throwDbError = (message, error) => { throw new Error(message + ': ' + error.message); };

// ===================================
// 1. READ (Browse & Detail)
// ===================================

exports.getPermintaanProduksiData = async (startDate, endDate) => {
    try {
        const sqlMaster = `
            SELECT
                mnt_nomor AS Nomor, 
                mnt_gdg_kode AS Gudang, 
                DATE_FORMAT(mnt_tanggal, '%d-%M-%Y') AS Tanggal, 
                mnt_keterangan AS Keterangan,
                mnt_lokasiproduksi AS Lokasi,
                mnt_status AS Status
            FROM tpermintaan_prod_hdr
            WHERE mnt_tanggal BETWEEN ? AND ?
            ORDER BY mnt_tanggal DESC;
        `;

        const [masterResults] = await pool.query(sqlMaster, [startDate, endDate]);
        const masterNomors = masterResults.map(row => row.Nomor);
        if (masterNomors.length === 0) return [];

        const sqlDetail = `
            SELECT
                mntd_mnt_nomor AS Nomor, 
                mntd_brg_kode AS Kode, 
                mntd_spk_nomor AS Nomor_SPK,
                mntd_qty AS Jumlah, 
                mntd_brg_satuan AS Satuan,
                mntd_keterangan AS Keterangan,
                mntd_nourut AS NoUrut
            FROM tpermintaan_prod_dtl
            WHERE mntd_mnt_nomor IN (?)
            ORDER BY mntd_mnt_nomor, mntd_nourut;
        `;

        const [detailResults] = await pool.query(sqlDetail, [masterNomors]);

        const dataMap = new Map();
        masterResults.forEach(item => dataMap.set(item.Nomor, { ...item, Detail: [] }));
        detailResults.forEach(detail => {
            if (dataMap.has(detail.Nomor)) {
                dataMap.get(detail.Nomor).Detail.push(detail);
            }
        });

        return Array.from(dataMap.values());
    } catch (error) {
        throwDbError('Gagal mengambil data Permintaan Produksi', error);
    }
};

// ===================================
// 2. GENERATE NOMOR (getmaxkode)
// ===================================

// Tambahkan fungsi ini di permintaanProduksi.service.js jika belum ada
exports.getPermintaanProduksiDataByNomor = async (nomor) => {
    try {
        const sqlHeader = `
            SELECT
                mnt_nomor AS Nomor, 
                mnt_gdg_kode AS Gudang, 
                DATE_FORMAT(mnt_tanggal, '%Y-%m-%d') AS Tanggal, 
                mnt_keterangan AS Keterangan,
                mnt_lokasiproduksi AS Lokasi,
                mnt_status AS Status
            FROM tpermintaan_prod_hdr
            WHERE mnt_nomor = ?;
        `;
        const [headerResults] = await pool.query(sqlHeader, [nomor]);
        
        if (headerResults.length === 0) return null;

        const sqlDetail = `
            SELECT
                mntd_brg_kode AS SKU, 
                mntd_spk_nomor AS spk,
                mntd_qty AS qtyMinta, 
                mntd_brg_satuan AS satuan,
                mntd_keterangan AS keterangan,
                mntd_nourut AS NoUrut
            FROM tpermintaan_prod_dtl
            WHERE mntd_mnt_nomor = ?
            ORDER BY mntd_nourut;
        `;
        const [detailResults] = await pool.query(sqlDetail, [nomor]);

        return {
            ...headerResults[0],
            Details: detailResults
        };
    } catch (error) {
        throwDbError('Gagal mengambil detail nomor ' + nomor, error);
    }
};

exports.getNewNomor = async () => {
    const NOMERATOR = 'MNT';
    try {
        const currentYYMM = format(new Date(), 'yyMMdd'); 
        const searchPattern = `${NOMERATOR}-${currentYYMM}-%`;

        const sql = `SELECT MAX(mnt_nomor) AS MaxNomor FROM tpermintaan_prod_hdr WHERE mnt_nomor LIKE ?;`;
        const [results] = await pool.query(sql, [searchPattern]);

        const maxNomor = results[0].MaxNomor;
        let newNumber = '0001';

        if (maxNomor) {
            const lastNumberString = maxNomor.split('-').pop();
            const lastNumber = parseInt(lastNumberString, 10);
            newNumber = (lastNumber + 1).toString().padStart(4, '0');
        }

        return `${NOMERATOR}-${currentYYMM}-${newNumber}`;
    } catch (error) {
        throwDbError('Gagal mendapatkan nomor dokumen baru', error);
    }
};

// ===================================
// 3. SAVE / UPDATE (cxButton1Click)
// ===================================

exports.savePermintaanProduksi = async (data, isUpdate = false) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        // Tambahkan GudangKode ke dalam destrukturisasi data
        let { Nomor, Tanggal, Departemen, Keterangan, Details, User, GudangKode } = data;

        if (!isUpdate && (!Nomor || Nomor === 'AUTO')) {
            Nomor = await exports.getNewNomor();
        }

        if (isUpdate) {
            await connection.query(
                `UPDATE tpermintaan_prod_hdr 
                 SET mnt_tanggal=?, 
                     mnt_keterangan=?, 
                     mnt_lokasiproduksi=?, 
                     mnt_gdg_kode=?, -- Tambahkan update gudang jika diizinkan
                     user_modified=?, 
                     date_modified=NOW() 
                 WHERE mnt_nomor=?`,
                [Tanggal, Keterangan, Departemen, GudangKode, User, Nomor]
            );
            await connection.query('DELETE FROM tpermintaan_prod_dtl WHERE mntd_mnt_nomor = ?', [Nomor]);
        } else {
            await connection.query(
                `INSERT INTO tpermintaan_prod_hdr 
                (mnt_nomor, mnt_tanggal, mnt_gdg_kode, mnt_keterangan, mnt_lokasiproduksi, user_create, date_create) 
                VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                // SEBELUMNYA: 'WH-16' diganti menjadi variabel GudangKode
                [Nomor, Tanggal, GudangKode, Keterangan, Departemen, User]
            );
        }

        const detailValues = Details.map((d, index) => [
            Nomor, d.spk || '', d.sku, d.satuan, d.qtyMinta, d.keterangan || '', index + 1
        ]);

        if (detailValues.length > 0) {
            await connection.query(
                `INSERT INTO tpermintaan_prod_dtl 
                (mntd_mnt_nomor, mntd_spk_nomor, mntd_brg_kode, mntd_brg_satuan, mntd_qty, mntd_keterangan, mntd_nourut) 
                VALUES ?`,
                [detailValues]
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

// ===================================
// 4. DELETE
// ===================================

exports.deletePermintaanProduksi = async (nomor) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('DELETE FROM tpermintaan_prod_dtl WHERE mntd_mnt_nomor = ?', [nomor]);
        const [result] = await connection.query('DELETE FROM tpermintaan_prod_hdr WHERE mnt_nomor = ?', [nomor]);
        await connection.commit();
        return result.affectedRows > 0;
    } catch (error) {
        await connection.rollback();
        throwDbError('Gagal menghapus data', error);
    } finally {
        connection.release();
    }
};

// backend/services/permintaan.service.js

exports.lookupPermintaanProduksi = async (search = '', userDivisi) => {
    try {
        let filterDivisi = "";

        // Tentukan gudang berdasarkan divisi user
        if (userDivisi == 1) {
            filterDivisi = "AND h.mnt_gdg_kode = 'WH-16'";
        } else if (userDivisi == 4) {
            filterDivisi = "AND h.mnt_gdg_kode = 'WH-20'";
        } else {
            // Jika admin/divisi lain, tampilkan semua gudang WH
            filterDivisi = "AND h.mnt_gdg_kode LIKE 'WH%'";
        }

        const sql = `
            SELECT 
                h.mnt_nomor AS Nomor, 
                DATE_FORMAT(h.mnt_tanggal, '%d-%m-%Y') AS Tanggal, 
                h.mnt_lokasiproduksi AS Lokasi,
                h.mnt_gdg_kode AS Gudang,
                h.mnt_keterangan AS Keterangan,
                h.mnt_status AS Status
            FROM tpermintaan_prod_hdr h
            WHERE (h.mnt_nomor LIKE ? OR h.mnt_keterangan LIKE ?)
            ${filterDivisi} 
            ORDER BY h.mnt_tanggal DESC
            LIMIT 50;
        `;

        const pattern = `%${search}%`;
        const [results] = await pool.query(sql, [pattern, pattern]);
        return results;
    } catch (error) {
        throw new Error('Gagal mengambil lookup daftar permintaan: ' + error.message);
    }
};