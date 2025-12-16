// backend/services/lhkCetak.service.js
const pool = require('../config/db.config'); // Pastikan path ini benar
const { format } = require('date-fns'); 

// --- KONSTANTA ---
const NOMERATOR = 'MMT-LHK-M';

// =========================================================================
// 1. FUNGSI READ (GET)
// =========================================================================

/**
 * Mengambil daftar master LHK Cetak
 * @param {string} startDate - Tanggal mulai (YYYY-MM-DD)
 * @param {string} endDate - Tanggal selesai (YYYY-MM-DD)
 * @returns {Promise<Array<Object>>}
 */
const getAllHeaders = async (startDate, endDate) => {
    // Format tanggal agar aman untuk SQL (Walaupun sudah YYYY-MM-DD, lebih aman di-parse)
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    const sql = `
        SELECT 
            t1.lnomor AS Nomor, 
            t1.lshift AS Shift, 
            t1.ltanggal AS Tanggal, 
            t1.lmesin AS Mesin, 
            t1.lspk_nomor AS NomorSPK, 
            t2.spk_nama AS NamaOrder,
            t2.spk_kain,
            t2.spk_gramasi,
            ROUND(IFNULL(t2.spk_panjang,0),2) AS spk_panjang,
            IFNULL(t2.spk_lebar,0) AS spk_lebar,
            IFNULL(t2.spk_jumlah,0) AS JumlahOrder,
            x.qtytotalcetak AS TotalCetak,
            t1.lbahan AS Kode_bahan,
            t3.brg_nama AS nama_Bahan,
            IFNULL(t1.ljumlah_kolom,0) AS Tile,
            IFNULL(t1.lpanjang,0) AS UkuranCetak,
            IFNULL(t1.lfixed,0) AS Fixed,
            t1.loperator AS Operator,
            t1.lgdg_prod AS Gudang
        FROM tlhk_mesin_hdr t1
        LEFT JOIN tspk t2 ON t2.spk_nomor = t1.lspk_nomor
        LEFT JOIN tbarang_mmt t3 ON t3.brg_kode = t1.lbahan
        LEFT JOIN (
            SELECT 
                ld_lnomor,
                SUM(ld_qtyCetak1 + ld_qtyCetak2 + ld_qtyCetak3 + ld_qtyCetak4 + ld_qtyCetak5 + ld_qtyCetak6 + ld_qtyCetak7) AS qtytotalcetak
            FROM tlhk_mesin_dtl 
            GROUP BY ld_lnomor
        ) x ON x.ld_lnomor = t1.lnomor
        WHERE t1.ltanggal BETWEEN ? AND ?
    `;
    
    const [rows] = await pool.query(sql, [tglMulai, tglSelesai]);
    return rows;
};


const getDetailsByNomor = async (nomor) => {
    const sql = `
        SELECT ld_lnomor AS Nomor, ld_urut AS NoUrut,
            ld_ambilbahan AS AmbilBahanPanjang,
           -- ld_ambilbahan_lebar AS AmbilBahanLebar, -- DIASUMSIKAN ADA KOLOM INI
            ld_qtyCetak1 AS J_Cetak1,
            ld_qtyCetak2 AS J_Cetak2,
            ld_qtyCetak3 AS J_Cetak3,
            ld_qtyCetak4 AS J_Cetak4,
            ld_qtyCetak5 AS J_Cetak5,
            ld_total_qtycetak AS TotalCetak,
            ld_total_metercetak AS Total_Cetak_Meter,
            ld_bsmeter AS Sisa_Lebar_BS,
            ld_sisameter AS Sisa_Panjang,
            ld_roll AS Roll,
            ld_bahan AS Kode_bahan_Detail -- OPSIONAL: Jika bahan bisa berbeda per detail
        FROM tlhk_mesin_dtl
        WHERE ld_lnomor = ?
        ORDER BY ld_urut
    `;
    
    const [rows] = await pool.query(sql, [nomor]);
    return rows;
};

const getLookupByNomor = async (nomor) => {
    // 1. Ambil Detail
    const details = await getDetailsByNomor(nomor);
    
    if (details.length === 0) {
        // Tidak perlu throw error di service, cukup kembalikan null atau data kosong
        return null; 
    }

    // 2. Ambil Header tunggal (menggunakan query yang sudah ada)
    const headerSql = `
        SELECT 
            t1.lnomor AS Nomor, 
            t1.lshift AS Shift, 
            t1.ltanggal AS Tanggal, 
            t1.lmesin AS Mesin, 
            t1.lspk_nomor AS NomorSPK, 
            t2.spk_nama AS NamaOrder,
            t2.spk_panjang AS spk_panjang,
            t2.spk_lebar AS spk_lebar,
            x.qtytotalcetak AS TotalCetak,
            t1.loperator AS Operator,
            t1.lgdg_prod AS Gudang,
            t1.lbahan AS Kode_bahan,
            t1.lpanjang AS UkuranCetak,
            t1.ljumlah_kolom AS Tile,
            t1.lfixed AS Fixed
        FROM tlhk_mesin_hdr t1
        LEFT JOIN tspk t2 ON t2.spk_nomor = t1.lspk_nomor
        LEFT JOIN (
            SELECT ld_lnomor, SUM(ld_total_qtycetak) AS qtytotalcetak
            FROM tlhk_mesin_dtl 
            WHERE ld_lnomor = ?
            GROUP BY ld_lnomor
        ) x ON x.ld_lnomor = t1.lnomor
        WHERE t1.lnomor = ?
    `;
    
    const [headerRows] = await pool.query(headerSql, [nomor, nomor]);

    if (headerRows.length === 0) {
        return null;
    }
    
    const combinedData = {
        header: headerRows[0],
        details: details
    };

    return combinedData;
};
/**
 * Mengambil nomor urut maksimum dari bulan dan tahun saat ini
 * @param {Date} date - Tanggal untuk menentukan YYMM
 * @returns {Promise<string>} - Nomor LHK yang baru
 * @param {Object} headerData - Data header LHK (HARUS SUDAH DI MAPPING DARI FRONTEND)
 * @param {Array<Object>} detailsData - Array data detail LHK (HARUS SUDAH DI MAPPING DARI FRONTEND)
 * @param {string | null} existingNomor - Nomor LHK jika mode edit, null jika baru
 * @returns {Promise<Object>} - Hasil operasi simpan
 */
const generateNewNomor = async (date) => {
    // Pastikan input adalah objek Date yang valid
    const dateToUse = date instanceof Date ? date : new Date(date); 
    
    const yymm = format(dateToUse, 'yyMM');
    // Asumsi: tlhk_mesin_hdr memiliki kolom lnomor
    const prefixLike = `${NOMERATOR}.${yymm}.%`; 

    const sqlMax = `
        SELECT MAX(CAST(SUBSTRING(lnomor, -4) AS UNSIGNED)) AS max_num
        FROM tlhk_mesin_hdr
        WHERE lnomor LIKE ?
    `;

    // Pastikan pool.query dapat diakses
    const [rows] = await pool.query(sqlMax, [prefixLike]); 
    const maxNum = rows && rows.length > 0 ? (rows[0].max_num || 0) : 0;
    
    let newSequence = maxNum + 1;
    const formattedSequence = String(newSequence).padStart(4, '0');
    
    const newNomor = `${NOMERATOR}.${yymm}.${formattedSequence}`;
    
    return newNomor;
};


/**
 * 2. Mendapatkan Nama Bahan (Digunakan di saveLhk)
 * Menggunakan tbarang_mmt (sesuai skema yang dikonfirmasi)
 */
const getNamaBahan = async (conn, kodeBahan) => {
    // Pastikan brg_kode dan brg_nama sesuai skema tbarang_mmt
    const [rows] = await conn.query('SELECT brg_nama FROM tbarang_mmt WHERE brg_kode = ?', [kodeBahan]);
    return rows && rows.length > 0 ? rows[0].brg_nama : `Bahan ${kodeBahan}`;
};

const generateKodeBahanSisa = async (conn, kodeAwal, date, urutDetail) => {

    const MAX_BASE_LENGTH = 13; 
    const kodeDasar = kodeAwal.split('-')[0].substring(0, MAX_BASE_LENGTH); 

    const seq = String(urutDetail).padStart(3, '0');
    
    let attempt = 1;
    let newKode;
    do {
        const suffix = attempt > 1 ? String.fromCharCode(64 + attempt) : ''; 
        newKode = `${kodeDasar}-${seq}-SP${suffix}`; 
        if (newKode.length > 20) {
            throw new Error(`Kode sisa hasil konkat (${newKode}) melebihi 20 karakter. Periksa kode awal.`);
        }

        const [check] = await conn.query('SELECT brg_kode FROM tbarang_mmt WHERE brg_kode = ?', [newKode]);
        if (check.length === 0) return newKode;
        
        attempt++;
    } while (attempt < 10);
    
    throw new Error("Gagal membuat kode bahan sisa unik setelah 10 percobaan.");
};


const saveLhk = async (headerData, detailsData, existingNomor) => {
    // ASUMSI: pool, format, generateNewNomor, getNamaBahan, generateKodeBahanSisa sudah didefinisikan
    const conn = await pool.getConnection();
    let isEditMode = existingNomor ? true : false;
    let finalNomor = existingNomor; 

    // --- Validasi Awal & Setup ---
    if (!headerData || !detailsData || detailsData.length === 0) {
        conn.release();
        throw new Error("Header atau Detail tidak boleh kosong.");
    }

    try {
        await conn.beginTransaction();
        
        const now = new Date();
        const dateToUse = headerData.ltanggal ? new Date(headerData.ltanggal) : now; 
        const formattedDate = format(dateToUse, 'yyyy-MM-dd');
        const formattedNow = format(now, 'yyyy-MM-dd HH:mm:ss');
        const user = headerData.luser_Create || headerData.luser_modified;
        const spkNomor = headerData.lspk_nomor || '';

        // 1. Tentukan Nomor LHK
        if (!isEditMode) {
            finalNomor = await generateNewNomor(dateToUse);
        } 
        if (!finalNomor) {
            throw new Error(isEditMode ? "Nomor LHK lama tidak valid." : "Gagal mendapatkan nomor LHK baru.");
        }

        // 2. Simpan/Update Header
        if (isEditMode) {
            // Mode EDIT: Update Header & Hapus Detail Lama
            const sqlUpdateHeader = `
                UPDATE tlhk_mesin_hdr SET
                    ltanggal = ?, lgdg_prod = ?, lspk_nomor = ?, lmesin = ?, 
                    lshift = ?, loperator = ?, lbahan = ?, lpanjang = ?, 
                    ljumlah_kolom = ?, lfixed = ?, lDate_modified = ?, luser_modified = ?
                WHERE lnomor = ?
            `;
            const headerValues = [
                formattedDate, headerData.lgdg_prod, headerData.lspk_nomor, headerData.lmesin, 
                headerData.lshift, headerData.loperator, headerData.lbahan, headerData.lpanjang, 
                headerData.ljumlah_kolom, headerData.lfixed, formattedNow, user, finalNomor
            ];
            await conn.query(sqlUpdateHeader, headerValues);
            await conn.query('DELETE FROM tlhk_mesin_dtl WHERE ld_lnomor = ?', [finalNomor]);
        } else {
            const sqlInsertHeader = `
                INSERT INTO tlhk_mesin_hdr (
                    lnomor, lspk_nomor, ltanggal, lmesin, lgdg_prod, 
                    lshift, loperator, ldate_create, luser_Create, 
                    lbahan, lpanjang, ljumlah_kolom, lfixed
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const headerValues = [
                finalNomor, headerData.lspk_nomor, formattedDate, headerData.lmesin, headerData.lgdg_prod, 
                headerData.lshift, headerData.loperator, formattedNow, user, headerData.lbahan, 
                headerData.lpanjang, headerData.ljumlah_kolom, headerData.lfixed 
            ];
            await conn.query(sqlInsertHeader, headerValues);
        }

        const sqlInsertDetail = `
            INSERT INTO tlhk_mesin_dtl (
                ld_lnomor, ld_urut, ld_ambilbahan, ld_ambilbahan_lebar,
                ld_qtyCetak1, ld_qtyCetak2, ld_qtyCetak3, ld_qtyCetak4, ld_qtyCetak5, 
                ld_qtyCetak6, ld_qtyCetak7, 
                ld_total_qtycetak, ld_total_metercetak, ld_roll, ld_sisameter, 
                ld_sisalebar, ld_bahan 
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `; 
        
        const sqlMutasi = `
            INSERT INTO tmasterstok_mmt (
                mst_brg_kode, mst_gdg_kode, mst_stok_in, mst_stok_out, 
                mst_panjang, mst_lebar, mst_spk_nomor, mst_noreferensi, 
                mst_hargabeli, mst_tanggal
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        let detailUrut = 1;
        for (const detail of detailsData) {
            if ((detail.totalcetak || 0) === 0 && (detail.ambilBahanPanjang || 0) === 0) {
                continue;
            }

            const ambilBahanPanjang = parseFloat(detail.ambilBahanPanjang) || 0; 
            const ambilBahanLebar = parseFloat(detail.ambilBahanLebar) || 0;   
            const sisaPanjangRoll = parseFloat(detail.sisabahan) || 0;       
            const sisaLebarRoll = parseFloat(detail.sisabahanlebar) || 0;    
            const kodeBahanAwal = detail.kodebahan || headerData.lbahan;

            // --- 3.A. INSERT DETAIL (tlhk_mesin_dtl) ---
            const detailValues = [ 
                finalNomor, detailUrut, ambilBahanPanjang, ambilBahanLebar, 
                detail.cetak1 || 0, detail.cetak2 || 0, detail.cetak3 || 0, detail.cetak4 || 0, detail.cetak5 || 0, 
                detail.cetak6 || 0, detail.cetak7 || 0, 
                detail.totalcetak || 0, detail.cetakmeter || 0, detail.roll || 0, 
                sisaPanjangRoll, sisaLebarRoll, kodeBahanAwal 
            ];
            await conn.query(sqlInsertDetail, detailValues);

            if (ambilBahanPanjang > 0 && ambilBahanLebar > 0) {
                const mutasiOutValues = [
                    kodeBahanAwal, headerData.lgdg_prod, 0, 1, 
                    ambilBahanPanjang, ambilBahanLebar, 
                    spkNomor, finalNomor, 0, formattedDate
                ];
                await conn.query(sqlMutasi, mutasiOutValues);
            }

            if (sisaPanjangRoll > 0 && sisaLebarRoll > 0) {
                const newKodeSisa = await generateKodeBahanSisa(conn, kodeBahanAwal, formattedDate, detailUrut); 
                const namaBahanAwal = await getNamaBahan(conn, kodeBahanAwal); 
                const newNamaSisa = `${namaBahanAwal} SISA P${sisaPanjangRoll} L${sisaLebarRoll}`;
                const sqlInsertMasterBahan = `
                    INSERT INTO tbarang_mmt (brg_kode, brg_nama, brg_satuan, brg_panjang, brg_lebar, brg_isstok)
                    VALUES (?, ?, ?, ?, ?, 1) 
                    ON DUPLICATE KEY UPDATE brg_panjang=VALUES(brg_panjang), brg_lebar=VALUES(brg_lebar)
                `;
                
                await conn.query(sqlInsertMasterBahan, [
                    newKodeSisa, 
                    newNamaSisa, 
                    'M', // brg_satuan
                    sisaPanjangRoll, 
                    sisaLebarRoll, 
                    formattedDate // brg_tanggal
                ]);
                const mutasiInSisaValues = [
                    newKodeSisa, headerData.lgdg_prod, 1, 0, 
                    sisaPanjangRoll, sisaLebarRoll, 
                    spkNomor, finalNomor, 0, formattedDate
                ];
                await conn.query(sqlMutasi, mutasiInSisaValues);
            }

            detailUrut++;
        }
        
        await conn.commit();
        return { success: true, message: `Data berhasil disimpan dengan nomor: ${finalNomor}`, nomor: finalNomor, isEdit: isEditMode };
        
    } catch (error) {
        await conn.rollback();
        console.error('Gagal Simpan LHK:', error);
        throw new Error('Gagal Simpan data. Detail Error: ' + error.message);
    } finally {
        conn.release();
    }
};


/**
 * Menghapus LHK Header dan Detail
 * @param {string} nomor - Nomor LHK
 */
const deleteLhk = async (nomor) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        
        // 1. Hapus detail (Tabel: tlhk_mesin_dtl)
        await conn.query('DELETE FROM tlhk_mesin_dtl WHERE ld_lnomor = ?', [nomor]);
        
        // 2. Hapus header (Tabel: tlhk_mesin_hdr)
        await conn.query('DELETE FROM tlhk_mesin_hdr WHERE lnomor = ?', [nomor]);
        
        await conn.commit();
        return { success: true, message: 'Berhasil dihapus.' };
    } catch (error) {
        await conn.rollback();
        console.error('Gagal Hapus LHK:', error);
        throw new Error('Gagal Hapus.');
    } finally {
        conn.release();
    }
};

module.exports = {
    getAllHeaders,
    getDetailsByNomor,
    getLookupByNomor,
    generateNewNomor,
    getNamaBahan,
    generateKodeBahanSisa,
    deleteLhk,
    generateNewNomor, 
    saveLhk
};