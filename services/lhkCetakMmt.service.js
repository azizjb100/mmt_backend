// backend/services/lhkCetak.service.js
const pool = require('../config/db.config'); 
const { format } = require('date-fns');

// --- KONSTANTA ---
const NOMERATOR = 'MMT-LHK-C';

// =========================================================================
// 1. FUNGSI READ (GET)
// =========================================================================

/**
 * Mengambil daftar master LHK Cetak (Logika SQL diadaptasi dari Delphi)
 */
const getAllHeaders = async (startDate, endDate) => {
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    // Menggunakan query dari Delphi: tlhk_cetakmmt_hdr
    const sql = `
        SELECT 
            lch_nomor AS Nomor, 
            DATE_FORMAT(lch_tanggal, '%Y-%m-%d') AS Tanggal, 
            lch_gdg_prod AS Gudang, 
            gdg_nama AS Nama_Gudang, 
            lch_shift AS Shift, 
            lch_operator AS Operator,
            (SELECT IF(COUNT(*) > COUNT(IF(LENGTH(lcd_brg_kode)>0, 1, NULL)), 'N','Y') 
             FROM tlhk_cetakmmt_dtl WHERE lcd_lch_nomor = lch_nomor) AS Lengkap,
            (SELECT SUM(lcd_qty_Cetak * spk_panjang * spk_lebar) 
             FROM tlhk_cetakmmt_dtl 
             LEFT JOIN tspk ON (spk_nomor = lcd_spk_nomor)
             WHERE lcd_lch_nomor = lch_nomor) AS cetak_meter
        FROM tlhk_cetakmmt_hdr 
        LEFT JOIN tGUDANG ON (gdg_kode = lch_gdg_prod)
        WHERE lch_tanggal BETWEEN ? AND ?
        ORDER BY lch_tanggal DESC, lch_nomor DESC
    `;

    const [rows] = await pool.query(sql, [tglMulai, tglSelesai]);
    return rows;
};

/**
 * Mengambil detail LHK berdasarkan nomor (Untuk sub-table / expanded row)
 */
const getDetailsByNomor = async (nomor) => {
    const sqlDetail = `
        SELECT 
            d.lcd_lch_nomor AS Nomor,
            d.lcd_jns_mesin AS Mesin,
            d.lcd_spk_nomor AS Nomor_SPK,
            s.spk_nama AS Nama_SPK, 
            IFNULL(s.spk_panjang, 0) AS Panjang, 
            IFNULL(s.spk_lebar, 0) AS Lebar,
            s.spk_jumlah AS Jml_Order,
            d.lcd_qty_cetak AS Jml_Cetak,
            d.lcd_loperator AS Operator,
            d.lcd_lshift AS Shift
        FROM tlhk_cetakmmt_dtl d
        LEFT JOIN tspk s ON s.spk_nomor = d.lcd_spk_nomor
        WHERE d.lcd_lch_nomor = ?
        ORDER BY d.lcd_no_urut ASC
    `;
    const [rows] = await pool.query(sqlDetail, [nomor]);
    return rows;
};

// =========================================================================
// 2. FUNGSI GENERATE NOMOR
// =========================================================================

const generateNewNomor = async (date) => {
    const yymm = format(new Date(date), 'yyMM');
    const prefixLike = `${NOMERATOR}.${yymm}.%`;

    const sqlMax = `
        SELECT MAX(CAST(SUBSTRING(lch_nomor, -4) AS UNSIGNED)) AS max_num
        FROM tlhk_cetakmmt_hdr
        WHERE lch_nomor LIKE ?
    `;

    const [rows] = await pool.query(sqlMax, [prefixLike]);
    const maxNum = rows[0]?.max_num || 0;
    const formattedSequence = String(maxNum + 1).padStart(4, '0');

    return `${NOMERATOR}.${yymm}.${formattedSequence}`;
};

// =========================================================================
// 3. FUNGSI SIMPAN (SAVE/UPDATE)
// =========================================================================

const saveLhk = async (headerData, detailsData, existingNomor) => {
    const conn = await pool.getConnection();
    let isEditMode = !!existingNomor;
    let finalNomor = existingNomor;

    try {
        await conn.beginTransaction();

        if (!isEditMode) {
            finalNomor = await generateNewNomor(headerData.Tanggal);
        }

        const formattedDate = format(new Date(headerData.Tanggal), 'yyyy-MM-dd');

        if (isEditMode) {
            // Update Header
            await conn.query(`
                UPDATE tlhk_cetakmmt_hdr SET
                    lch_tanggal = ?, lch_gdg_prod = ?, lch_shift = ?, 
                    lch_operator = ?, lch_user_edit = ?
                WHERE lch_nomor = ?
            `, [formattedDate, headerData.Gudang, headerData.Shift, headerData.Operator, headerData.User, finalNomor]);
            
            // Delete old details to replace with new ones (standard Delphi logic)
            await conn.query(`DELETE FROM tlhk_cetakmmt_dtl WHERE lcd_lch_nomor = ?`, [finalNomor]);
        } else {
            // Insert Header
            await conn.query(`
                INSERT INTO tlhk_cetakmmt_hdr (lch_nomor, lch_tanggal, lch_gdg_prod, lch_shift, lch_operator)
                VALUES (?, ?, ?, ?, ?)
            `, [finalNomor, formattedDate, headerData.Gudang, headerData.Shift, headerData.Operator]);
        }

        // Insert Details
        for (let i = 0; i < detailsData.length; i++) {
            const d = detailsData[i];
            await conn.query(`
                INSERT INTO tlhk_cetakmmt_dtl (
                    lcd_lch_nomor, lcd_no_urut, lcd_spk_nomor, lcd_qty_Cetak, 
                    lcd_jns_mesin, lcd_loperator, lcd_lshift, lcd_brg_kode
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [finalNomor, i + 1, d.Nomor_SPK, d.Jml_Cetak, d.Mesin, headerData.Operator, headerData.Shift, d.Kode_Bahan]);
        }

        await conn.commit();
        return { success: true, nomor: finalNomor };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

// =========================================================================
// 4. FUNGSI DELETE
// =========================================================================

const deleteLhk = async (nomor) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        // Sesuai logika Delphi (cxButton4Click)
        await conn.query('DELETE FROM tlhk_cetakmmt_dtl WHERE lcd_lch_nomor = ?', [nomor]);
        await conn.query('DELETE FROM tlhk_cetakmmt_hdr WHERE lch_nomor = ?', [nomor]);

        await conn.commit();
        return { success: true };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

module.exports = {
    getAllHeaders,
    getDetailsByNomor,
    generateNewNomor,
    saveLhk,
    deleteLhk
};