// backend/src/services/permintaanProduksi.service.js

const pool = require('../config/db.config');
const { format } = require('date-fns');

// Helper untuk throw error (diasumsikan sudah didefinisikan)
const throwDbError = (message, error) => { throw new Error(message + ': ' + error.message); };

// ===================================
// 1. READ ALL (btnRefreshClick)
// ===================================
exports.getPermintaanProduksiData = async (startDate, endDate) => {
    try {
        // Query SQL Master (Header Permintaan)
        const sqlMaster = `
            SELECT
                mnt_nomor AS Nomor, mnt_gdg_kode AS Gudang, gdg_nama AS Nama,
                DATE_FORMAT(mnt_tanggal, '%d-%M-%Y') AS Tanggal, mnt_keterangan AS Keterangan
            FROM tminta_mmt_hdr
            LEFT JOIN tminta_mmt_dtl ON mntd_mnt_nomor = mnt_nomor
            LEFT JOIN tgudang ON gdg_kode = mnt_gdg_kode
            WHERE mnt_tanggal BETWEEN ? AND ?
                AND mntd_brg_kode IN (SELECT brg_kode FROM tbarang_mmt WHERE brg_gdg_default = 'WH-16')
                AND gdg_kode LIKE '%WH%'
            GROUP BY mnt_gdg_kode, mnt_nomor, mnt_tanggal, mnt_keterangan
            ORDER BY mnt_tanggal DESC;
        `;
        
        const [masterResults] = await pool.query(sqlMaster, [startDate, endDate]);
        const masterNomors = masterResults.map(row => row.Nomor);
        if (masterNomors.length === 0) return [];

        // Query SQL Detail (Item Permintaan)
        const sqlDetail = `
            SELECT
                mntd_mnt_nomor AS Nomor, brg_kode AS Kode, TRIM(brg_nama) AS Nama_Bahan,
                brg_panjang * 1 AS Panjang, brg_lebar * 1 AS Lebar, mntd_brg_satuan AS Satuan,
                mntd_qty AS Jumlah, mntd_operator AS Operator, mntd_spk_nomor AS Nomor_SPK,
                TRIM(nama) AS spk_nama, mntd_keterangan AS Keterangan
            FROM tminta_mmt_dtl
            LEFT JOIN tbarang_mmt ON mntd_brg_kode = brg_kode
            LEFT JOIN v_help_spk ON spk = mntd_spk_nomor
            WHERE mntd_mnt_nomor IN (?)
            ORDER BY mntd_mnt_nomor, mntd_nourut;
        `;
        
        const [detailResults] = await pool.query(sqlDetail, [masterNomors]); 

        // Menggabungkan Master dan Detail
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
        
        let newNumber = '0001'; // Nilai default: 0001 (jika belum ada nomor)

        // 4. Logika Inkrementasi Nomor Urut
        if (maxNomor) {
            // Ambil nomor urut terakhir dari string (misalnya '0045')
            const lastNumberString = maxNomor.substring(maxNomor.lastIndexOf('.') + 1);
            
            // Konversi ke integer dan tambahkan 1
            const lastNumber = parseInt(lastNumberString, 10);
            
            // Format kembali menjadi string 4 digit dengan leading zero
            newNumber = (lastNumber + 1).toString().padStart(4, '0');
        }

        // 5. Gabungkan dan kembalikan nomor dokumen lengkap
        return `${NOMERATOR}.${currentYYMM}.${newNumber}`;
        
    } catch (error) {
        throwDbError('Gagal mendapatkan nomor dokumen MMT.MP baru', error);
    }
};

exports.savePermintaanProduksi = async (data, isUpdate = false) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { 
            Nomor, Gudang, Tanggal, Keterangan, User, Details, LokasiProduksi // Mnt Lokasi Produksi
        } = data;
        
        // --- Ambil Gudang Tujuan (IN) ---
        const GudangTujuan = LokasiProduksi || null; 
        
        // --- 2. Update/Insert Header (tminta_mmt_hdr) ---
        if (isUpdate) {
            // A. UPDATE HEADER
            const updateHeaderSql = `
                UPDATE tminta_mmt_hdr SET
                    mnt_gdg_kode = ?, mnt_lokasiproduksi = ?, mnt_tanggal = ?, mnt_keterangan = ?, user_modified = ?
                WHERE mnt_nomor = ?;
            `;
            // Perbaikan: Tambahkan GudangTujuan (Lokasi Produksi) ke query update
            await connection.query(updateHeaderSql, [Gudang, GudangTujuan, Tanggal, Keterangan, User, Nomor]);

            // B1. HAPUS ENTRI STOK LAMA (Tetap di sini)
            await connection.query('DELETE FROM tmasterstok_mmt WHERE mst_noreferensi = ?', [Nomor]);

            // B2. HAPUS DETAIL LAMA 
            await connection.query('DELETE FROM tminta_mmt_dtl WHERE mntd_mnt_nomor = ?', [Nomor]);

        } else {
            // A. INSERT HEADER (Baru)
            const insertHeaderSql = `
                INSERT INTO tminta_mmt_hdr 
                    (mnt_nomor, mnt_gdg_kode, mnt_lokasiproduksi, mnt_tanggal, mnt_keterangan, user_create) 
                VALUES (?, ?, ?, ?, ?, ?);
            `;
            // Perbaikan: Tambahkan GudangTujuan (Lokasi Produksi) ke query insert
            await connection.query(insertHeaderSql, [Nomor, Gudang, GudangTujuan, Tanggal, Keterangan, User]);
        }

        // --- 3. Insert Detail Baru (tminta_mmt_dtl) ---
        // (Kode Detail tidak berubah)
        const detailValues = Details.map((d, index) => [
            Nomor, 
            index + 1,      // mntd_nourut
            d.Kode, 
            d.Jumlah, 
            d.Satuan, 
            d.Operator || null, 
            d.Nomor_SPK || null, 
            d.Keterangan || null,
        ]);
        
        if (detailValues.length > 0) {
            const insertDetailSql = `
                INSERT INTO tminta_mmt_dtl 
                    (mntd_mnt_nomor, mntd_nourut, mntd_brg_kode, mntd_qty, mntd_brg_satuan, 
                     mntd_operator, mntd_spk_nomor, mntd_keterangan) 
                VALUES ?;
            `;
            await connection.query(insertDetailSql, [detailValues]); 
        }

        // --- 4. Proses Insert ke Master Stok (DILAKUKAN OLEH TRIGGER) ---

        await connection.commit();
        return { success: true, nomor: Nomor };

    } catch (error) {
        await connection.rollback();
        throwDbError('Gagal menyimpan transaksi Permintaan Material', error);
    } finally {
        connection.release();
    }
};