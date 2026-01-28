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
        ORDER BY t1.ltanggal DESC, t1.lnomor DESC
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
            ld_sisalebar AS Sisa_Lebar,
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
            t1.lbarcode_roll,
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
    const dateToUse = date instanceof Date ? date : new Date(date);

    const yymm = format(dateToUse, 'yyMM');
    const prefixLike = `${NOMERATOR}.${yymm}.%`;

    const sqlMax = `
        SELECT MAX(CAST(SUBSTRING(lnomor, -4) AS UNSIGNED)) AS max_num
        FROM tlhk_mesin_hdr
        WHERE lnomor LIKE ?
    `;

    const [rows] = await pool.query(sqlMax, [prefixLike]);
    const maxNum = rows && rows.length > 0 ? (rows[0].max_num || 0) : 0;

    let newSequence = maxNum + 1;
    const formattedSequence = String(newSequence).padStart(4, '0');

    const newNomor = `${NOMERATOR}.${yymm}.${formattedSequence}`;

    return newNomor;
};

/**
 * @param {Object} headerData - Data header termasuk lstatus ('DRAFT' atau 'POSTED')
 * @param {Array} detailsData - Data detail produksi
 * @param {String} existingNomor - Nomor jika mode edit
 */
const saveLhk = async (headerData, detailsData, existingNomor) => {
    const conn = await pool.getConnection();
    let isEditMode = !!existingNomor;
    let finalNomor = existingNomor;
    
    // Status dari frontend: 'DRAFT' (Simpan Sementara) atau 'POSTED' (Simpan Hasil)
    const currentStatus = headerData.lstatus || 'DRAFT';

    if (!headerData || !Array.isArray(detailsData) || detailsData.length === 0) {
        if (conn) conn.release();
        throw new Error("Header atau Detail tidak boleh kosong.");
    }

    try {
        await conn.beginTransaction();

        const now = new Date();
        const dateToUse = headerData.ltanggal ? new Date(headerData.ltanggal) : now;
        const formattedDate = format(dateToUse, 'yyyy-MM-dd');
        const formattedNow = format(now, 'yyyy-MM-dd HH:mm:ss');

        const user = headerData.luser_create || headerData.luser_modified || 'SYSTEM';
        const spkNomorHeader = headerData.lspk_nomor || '';

        // 1. GENERATE NOMOR (Hanya jika data baru)
        if (!isEditMode) {
            finalNomor = await generateNewNomor(dateToUse);
        }

        // 2. HITUNG TOTAL PANJANG TERPAKAI
        const totalPanjangTerpakai = detailsData.reduce((sum, d) => sum + Number(d.cetakmeter || 0), 0);

        // 3. HEADER (INSERT/UPDATE)
        if (isEditMode) {
            await conn.query(`
                UPDATE tlhk_mesin_hdr SET
                    ltanggal = ?, lgdg_prod = ?, lspk_nomor = ?, lmesin = ?,
                    lshift = ?, loperator = ?, lbahan = ?, lbarcode_roll = ?,
                    lpanjang_terpakai = ?, ljumlah_kolom = ?, lfixed = ?,
                    ldate_modified = ?, luser_modified = ?, lstatus = ?
                WHERE lnomor = ?
            `, [
                formattedDate, headerData.lgdg_prod, spkNomorHeader, headerData.lmesin,
                headerData.lshift, headerData.loperator, headerData.lbahan, headerData.lbarcode_roll,
                totalPanjangTerpakai, headerData.ljumlah_kolom, headerData.lfixed,
                formattedNow, user, currentStatus, finalNomor
            ]);

            // Bersihkan data lama untuk ditulis ulang
            await conn.query(`DELETE FROM tlhk_mesin_dtl WHERE ld_lnomor = ?`, [finalNomor]);
            await conn.query(`DELETE FROM tmasterstok_mmt WHERE mst_noreferensi = ?`, [finalNomor]);
        } else {
            await conn.query(`
                INSERT INTO tlhk_mesin_hdr (
                    lnomor, lspk_nomor, ltanggal, lmesin, lgdg_prod,
                    lshift, loperator, ldate_create, luser_create,
                    lbahan, lbarcode_roll, lpanjang_terpakai,
                    ljumlah_kolom, lfixed, lstatus
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                finalNomor, spkNomorHeader, formattedDate, headerData.lmesin, headerData.lgdg_prod,
                headerData.lshift, headerData.loperator, formattedNow, user,
                headerData.lbahan, headerData.lbarcode_roll, totalPanjangTerpakai,
                headerData.ljumlah_kolom, headerData.lfixed, currentStatus
            ]);
        }

        // 4. DETAIL
        let maxAmbilPanjang = 0;
        let finalSisaMeter = 0;
        let finalSisaLebar = 0;
        const usedBarcode = headerData.lbarcode_roll;
        const usedKodeBahan = headerData.lbahan;

        for (let i = 0; i < detailsData.length; i++) {
            const d = detailsData[i];
            const urut = i + 1;
            const totalCetak = (Number(d.cetak1) || 0) + (Number(d.cetak2) || 0) + (Number(d.cetak3) || 0) +
                               (Number(d.cetak4) || 0) + (Number(d.cetak5) || 0) + (Number(d.cetak6) || 0) + (Number(d.cetak7) || 0);

            await conn.query(`
                INSERT INTO tlhk_mesin_dtl (
                    ld_lnomor, ld_urut, ld_spk_nomor, ld_ambilbahan, ld_ambilbahan_lebar,
                    ld_qtyCetak1, ld_qtyCetak2, ld_qtyCetak3, ld_qtyCetak4,
                    ld_qtyCetak5, ld_qtyCetak6, ld_qtyCetak7,
                    ld_total_qtycetak, ld_total_metercetak, ld_sisameter, ld_sisalebar,
                    ld_bahan, ld_barcode
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                finalNomor, urut, d.nomor_spk || '', d.ambilBahanPanjang || 0, d.ambilBahanLebar || 0,
                d.cetak1 || 0, d.cetak2 || 0, d.cetak3 || 0, d.cetak4 || 0,
                d.cetak5 || 0, d.cetak6 || 0, d.cetak7 || 0,
                totalCetak, d.cetakmeter || 0, d.sisabahan || 0, d.sisabahanlebar || 0,
                usedKodeBahan, usedBarcode
            ]);

            if (Number(d.ambilBahanPanjang) > maxAmbilPanjang) maxAmbilPanjang = Number(d.ambilBahanPanjang);
            finalSisaMeter = Number(d.sisabahan || 0);
            finalSisaLebar = Number(d.sisabahanlebar || 0);
        }

        // 5. LOGIKA MUTASI STOK (HANYA JIKA STATUS BUKAN DRAFT)
        if (currentStatus === 'POSTED') {
            if (usedBarcode && maxAmbilPanjang > 0) {
                const initialLebar = detailsData[0].ambilBahanLebar || 0;

                // OUT → Kurangi roll utuh
                await conn.query(`
                    INSERT INTO tmasterstok_mmt (
                        mst_brg_kode, mst_gdg_kode, mst_stok_in, mst_stok_out,
                        mst_panjang, mst_lebar, mst_spk_nomor, mst_noreferensi,
                        mst_hargabeli, mst_tanggal, mst_barcode
                    ) VALUES (?, ?, 0, 1, ?, ?, ?, ?, 0, ?, ?)
                `, [usedKodeBahan, headerData.lgdg_prod, maxAmbilPanjang, initialLebar, spkNomorHeader, finalNomor, formattedDate, usedBarcode]);

                // IN → Kembalikan sisa panjang sebagai roll baru
                if (finalSisaMeter > 0) {
                    await conn.query(`
                        INSERT INTO tmasterstok_mmt (
                            mst_brg_kode, mst_gdg_kode, mst_stok_in, mst_stok_out,
                            mst_panjang, mst_lebar, mst_spk_nomor, mst_noreferensi,
                            mst_hargabeli, mst_tanggal, mst_barcode
                        ) VALUES (?, ?, 1, 0, ?, ?, ?, ?, 0, ?, ?)
                    `, [usedKodeBahan, headerData.lgdg_prod, finalSisaMeter, finalSisaLebar, spkNomorHeader, finalNomor, formattedDate, usedBarcode]);
                }
            }
        }

        await conn.commit();
        return { 
            success: true, 
            nomor: finalNomor, 
            status: currentStatus,
            message: currentStatus === 'DRAFT' ? 'Berhasil simpan sementara (stok tidak berubah)' : 'Berhasil simpan hasil (stok telah terpotong)'
        };

    } catch (err) {
        await conn.rollback();
        console.error("Error Save LHK:", err);
        throw new Error(`Gagal Simpan LHK: ${err.message}`);
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
        await conn.query('DELETE FROM tlhk_mesin_dtl WHERE ld_lnomor = ?', [nomor]);
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
    deleteLhk,
    generateNewNomor,
    saveLhk
};