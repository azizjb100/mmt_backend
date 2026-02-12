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


/**
 * Mengambil data LHK Cetak berdasarkan nomor (Header & Detail)
 * Pola struktur mengikuti getInvoicePembelianByNomor
 */
const getLookupByNomor = async (nomor) => {
    try {
        const sqlHeader = `
            SELECT 
                t1.lnomor AS Nomor, 
                t1.lshift AS Shift, 
                DATE_FORMAT(t1.ltanggal, '%Y-%m-%d') AS Tanggal,
                t1.lmesin AS Mesin, 
                t1.lbarcode_roll,
                t1.loperator AS Operator,
                t1.lgdg_prod AS Gudang,
                t1.lbahan AS Kode_bahan,
                t1.lstatus AS Status,
                t1.lpanjang_bs AS PanjangBS,
                t1.llebar_bs AS LebarBS
            FROM tlhk_mesin_hdr t1
            WHERE t1.lnomor = ?
        `;
        const [headerRows] = await pool.query(sqlHeader, [nomor]);

        if (headerRows.length === 0) {
            throw new Error(`LHK Cetak nomor ${nomor} tidak ditemukan`);
        }

        // 2. Query Detail (Memecah per SPK dan mengambil data dari tspk)
        const sqlDetail = `
            SELECT 
                d.ld_urut AS NoUrut,
                d.ld_spk_nomor AS ld_spk_nomor,
                s.spk_nama AS NamaOrder,
                s.spk_panjang AS spk_panjang,
                s.spk_lebar AS spk_lebar,
                s.spk_jumlah AS JumlahOrder,
                d.ld_ambilbahan AS AmbilBahanPanjang,
                d.ld_ambilbahan_lebar AS AmbilBahanLebar,
                d.ld_qtyCetak1 AS J_Cetak1,
                d.ld_qtyCetak2 AS J_Cetak2,
                d.ld_qtyCetak3 AS J_Cetak3,
                d.ld_qtyCetak4 AS J_Cetak4,
                d.ld_qtyCetak5 AS J_Cetak5,
                d.ld_qtyCetak6 AS J_Cetak6,
                d.ld_qtyCetak7 AS J_Cetak7,
                d.ld_total_qtycetak AS TotalCetak,
                d.ld_sisameter AS Sisa_Panjang,
                d.ld_sisalebar AS Sisa_Lebar,
                d.ld_tile AS Tile, 
                d.ld_luas_m2 AS Luas_m2,
                d.ld_padding AS Padding
            FROM tlhk_mesin_dtl d
            LEFT JOIN tspk s ON d.ld_spk_nomor = s.spk_nomor
            WHERE d.ld_lnomor = ?
            ORDER BY d.ld_urut ASC
        `;
        const [detailRows] = await pool.query(sqlDetail, [nomor]);

// PERBAIKAN: Bungkus dalam objek header dan details (huruf kecil)
return {
    header: headerRows[0],
    details: detailRows
};

    } catch (error) {
        // Menggunakan pola throw yang Anda berikan
        console.error("Error getLookupByNomor:", error);
        throw new Error(`Gagal mengambil data LHK Cetak: ${error.message}`);
    }
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


const getNextSuffix = async (conn, originalBarcode) => {
    const sql = `
        SELECT mst_barcode 
        FROM tmasterstok_mmt 
        WHERE mst_barcode LIKE ? 
        ORDER BY mst_barcode DESC LIMIT 1
    `;
    const [rows] = await conn.query(sql, [`${originalBarcode}-%`]);

    if (rows.length === 0) {
        return `${originalBarcode}-A`;
    }

    const lastBarcode = rows[0].mst_barcode;
    const lastPart = lastBarcode.split('-').pop(); 
    const nextCharCode = lastPart.charCodeAt(0) + 1;
    const nextSuffix = String.fromCharCode(nextCharCode);

    return `${originalBarcode}-${nextSuffix}`;
};

const saveLhk = async (headerData, detailsData, existingNomor) => {
    const conn = await pool.getConnection();
    let isEditMode = !!existingNomor;
    let finalNomor = existingNomor;
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

        const uniqueSpks = [...new Set(detailsData.map(d => d.nomor_spk).filter(s => s))];
        const combinedSpkNomor = uniqueSpks.join(', ');

        if (!isEditMode) {
            finalNomor = await generateNewNomor(dateToUse);
        }

        const totalPanjangTerpakai = detailsData.reduce((sum, d) => sum + Number(d.cetakmeter || 0), 0);

        if (isEditMode) {
            await conn.query(`
                UPDATE tlhk_mesin_hdr SET
                    ltanggal = ?, lgdg_prod = ?, lspk_nomor = ?, lmesin = ?,
                    lshift = ?, loperator = ?, lbahan = ?, lbarcode_roll = ?,
                    lpanjang_terpakai = ?, ljumlah_kolom = ?, lfixed = 'Y',
                    ldate_modified = ?, luser_modified = ?, lstatus = ?,
                    lpanjang_bs = ?, llebar_bs = ?
                WHERE lnomor = ?
            `, [
                formattedDate, headerData.lgdg_prod, combinedSpkNomor, headerData.lmesin,
                headerData.lshift, headerData.loperator, headerData.lbahan, headerData.lbarcode_roll,
                totalPanjangTerpakai, headerData.ljumlah_kolom, 
                formattedNow, user, currentStatus, 
                headerData.lpanjang_bs || 0, headerData.llebar_bs || 0,
                finalNomor
            ]);

            await conn.query(`DELETE FROM tlhk_mesin_dtl WHERE ld_lnomor = ?`, [finalNomor]);
            await conn.query(`DELETE FROM tmasterstok_mmt WHERE mst_noreferensi = ?`, [finalNomor]);
        } else {
            await conn.query(`
                INSERT INTO tlhk_mesin_hdr (
                    lnomor, lspk_nomor, ltanggal, lmesin, lgdg_prod,
                    lshift, loperator, ldate_create, luser_create,
                    lbahan, lbarcode_roll, lpanjang_terpakai,
                    ljumlah_kolom, lstatus, lpanjang_bs, llebar_bs, lpanjang_afal, llebar_afal, lfixed
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Y')
            `, [
                finalNomor, combinedSpkNomor, formattedDate, headerData.lmesin, headerData.lgdg_prod,
                headerData.lshift, headerData.loperator, formattedNow, user,
                headerData.lbahan, headerData.lbarcode_roll, totalPanjangTerpakai,
                headerData.ljumlah_kolom,  currentStatus,
                headerData.lpanjang_bs || 0, headerData.llebar_bs || 0, headerData.lpanjang_afal || 0, headerData.llebar_afal || 0
            ]);
        }

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
                    ld_qtyCetak1, ld_qtyCetak2, ld_qtyCetak3, ld_qtyCetak4, ld_qtyCetak5, ld_qtyCetak6, ld_qtyCetak7,
                    ld_total_qtycetak, ld_total_metercetak, ld_sisameter, ld_sisalebar,
                    ld_bahan, ld_barcode, ld_tile, ld_luas_m2, ld_padding
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                finalNomor, urut, d.nomor_spk || '', d.ambilBahanPanjang || 0, d.ambilBahanLebar || 0,
                d.cetak1 || 0, d.cetak2 || 0, d.cetak3 || 0, d.cetak4 || 0, d.cetak5 || 0, d.cetak6 || 0, d.cetak7 || 0,
                totalCetak, d.cetakmeter || 0, d.sisabahan || 0, d.sisabahanlebar || 0,
                usedKodeBahan, usedBarcode, d.tile || 1, d.luasm2 || 0, d.padding || 0
            ]);

            if (Number(d.ambilBahanPanjang) > maxAmbilPanjang) maxAmbilPanjang = Number(d.ambilBahanPanjang);
            finalSisaMeter = Number(d.sisabahan || 0);
            finalSisaLebar = Number(d.sisabahanlebar || 0);
        }

        // 6. MUTASI STOK (HANYA JIKA POSTED)
        if (currentStatus === 'POSTED') {
            if (usedBarcode && maxAmbilPanjang > 0) {
                const initialLebar = detailsData[0].ambilBahanLebar || 0;

                // MUTASI KELUAR (STOK LAMA HABIS)
                await conn.query(`
                    INSERT INTO tmasterstok_mmt (
                        mst_brg_kode, mst_gdg_kode, mst_stok_in, mst_stok_out,
                        mst_panjang, mst_lebar, mst_spk_nomor, mst_noreferensi,
                        mst_hargabeli, mst_tanggal, mst_barcode
                    ) VALUES (?, ?, 0, 1, ?, ?, ?, ?, 0, ?, ?)
                `, [usedKodeBahan, headerData.lgdg_prod, maxAmbilPanjang, initialLebar, combinedSpkNomor, finalNomor, formattedDate, usedBarcode]);

                // MUTASI MASUK (SISA UTAMA)
                if (finalSisaMeter > 0) {
                    await conn.query(`
                        INSERT INTO tmasterstok_mmt (
                            mst_brg_kode, mst_gdg_kode, mst_stok_in, mst_stok_out,
                            mst_panjang, mst_lebar, mst_spk_nomor, mst_noreferensi,
                            mst_hargabeli, mst_tanggal, mst_barcode
                        ) VALUES (?, ?, 1, 0, ?, ?, ?, ?, 0, ?, ?)
                    `, [usedKodeBahan, headerData.lgdg_prod, finalSisaMeter, finalSisaLebar, combinedSpkNomor, finalNomor, formattedDate, usedBarcode]);
                }

                // MUTASI MASUK (AFAL SISTEM) - CREATE BARCODE BARU OTOMATIS
                const afalP = headerData.lpanjang_afal || 0; 
        const afalL = headerData.llebar_afal || 0;

        if (afalP > 0 && afalL > 0) {
            const newAfalBarcode = await getNextSuffix(conn, usedBarcode);
            await conn.query(`
                INSERT INTO tmasterstok_mmt (
                    mst_brg_kode, mst_gdg_kode, mst_stok_in, mst_stok_out,
                    mst_panjang, mst_lebar, mst_spk_nomor, mst_noreferensi,
                    mst_hargabeli, mst_tanggal, mst_barcode
                ) VALUES (?, ?, 1, 0, ?, ?, ?, ?, 0, ?, ?)
            `, [usedKodeBahan, headerData.lgdg_prod, afalP, afalL, "STOK AFAL", finalNomor, formattedDate, newAfalBarcode]);
            
            console.log(`Barcode Afal Berhasil: ${newAfalBarcode}`);
        }
            }
        }

        await conn.commit();
        return { success: true, nomor: finalNomor, status: currentStatus };

    } catch (err) {
        if (conn) await conn.rollback();
        console.error("Error Save LHK:", err);
        throw new Error(`Gagal Simpan LHK: ${err.message}`);
    } finally {
        if (conn) conn.release();
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

/**
 * Fungsi untuk menentukan suffix alfabet berikutnya (-A, -B, dst)
 */

module.exports = {
    getAllHeaders,
    getLookupByNomor,
    generateNewNomor,
    deleteLhk,
    saveLhk
};