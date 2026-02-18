const pool = require('../config/db.config'); 
const { format } = require('date-fns');

const NOMERATOR = 'MMT-LHK-C';

// =========================================================================
// 1. FUNGSI READ (GET)
// =========================================================================

const getAllHeaders = async (startDate, endDate) => {
    // Memastikan parameter tanggal diformat dengan benar untuk MySQL
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    const sql = `
        SELECT 
            lch_nomor AS Nomor, 
            DATE_FORMAT(lch_tanggal, '%Y-%m-%d') AS Tanggal, 
            lch_gdg_prod AS Gudang, 
            g.gdg_nama AS Nama_Gudang, 
            lch_shift AS Shift, 
            lch_operator AS Operator,
            /* Cek Kelengkapan: Jika ada item yang belum punya kode barang */
            (SELECT IF(COUNT(*) > COUNT(IF(LENGTH(lcd_brg_kode)>0, 1, NULL)), 'N','Y') 
             FROM tlhk_cetakmmt_dtl WHERE lcd_lch_nomor = lch_nomor) AS Lengkap,
            /* Hitung Total Meter Cetak (Qty * P * L) */
            (SELECT SUM(lcd_qty_Cetak * IFNULL(spk_panjang,0) * IFNULL(spk_lebar,0)) 
             FROM tlhk_cetakmmt_dtl 
             LEFT JOIN tspk ON (spk_nomor = lcd_spk_nomor)
             WHERE lcd_lch_nomor = lch_nomor) AS cetak_meter
        FROM tlhk_cetakmmt_hdr h
        LEFT JOIN tGUDANG g ON (g.gdg_kode = h.lch_gdg_prod)
        WHERE h.lch_tanggal BETWEEN ? AND ?
        ORDER BY h.lch_tanggal DESC, h.lch_nomor DESC
    `;

    const [rows] = await pool.query(sql, [tglMulai, tglSelesai]);
    return rows;
};

const getDetailsByNomor = async (nomor) => {
    // Menggunakan UNION ALL agar bisa membaca dari tabel tspk DAN tmemospk (Sesuai Logika Delphi)
    const sqlDetail = `
        SELECT 
            d.lcd_lch_nomor AS Nomor,
            d.lcd_jns_mesin AS Mesin,
            d.lcd_spk_nomor AS Nomor_SPK,
            x.spk_nama AS Nama_SPK, 
            IFNULL(x.spk_panjang, 0) AS Panjang, 
            IFNULL(x.spk_lebar, 0) AS Lebar,
            x.spk_jumlah AS Jml_Order,
            d.lcd_qty_cetak AS Jml_Cetak,
            d.lcd_lnomor AS Nomor_lhk_mesin,
            d.lcd_loperator AS Operator,
            d.lcd_lshift AS Shift
        FROM tlhk_cetakmmt_dtl d
        LEFT JOIN (
            SELECT spk_nomor, spk_nama, spk_jumlah, spk_panjang, spk_lebar FROM tspk
            UNION ALL
            SELECT mspk_nomor, mspk_nama, mspk_jumlah, mspk_panjang, mspk_lebar FROM tmemospk
        ) x ON x.spk_nomor = d.lcd_spk_nomor
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

        const rawDate = headerData.lch_tanggal; 
        const dateToUse = (rawDate && !isNaN(new Date(rawDate).getTime())) 
            ? new Date(rawDate) 
            : new Date();

        if (!isEditMode) {
            finalNomor = await generateNewNomor(dateToUse);
        }

        const formattedDate = format(dateToUse, 'yyyy-MM-dd');

        if (isEditMode) {
            await conn.query(`
                UPDATE tlhk_cetakmmt_hdr SET
                    lch_tanggal = ?, lch_gdg_prod = ?, lch_shift = ?, 
                    lch_operator = ?, lch_user_edit = ?
                WHERE lch_nomor = ?
            `, [formattedDate, headerData.lch_gdg_prod, headerData.lch_shift, headerData.lch_operator, headerData.lch_user, finalNomor]);
            
            await conn.query(`DELETE FROM tlhk_cetakmmt_dtl WHERE lcd_lch_nomor = ?`, [finalNomor]);
        } else {
            await conn.query(`
                INSERT INTO tlhk_cetakmmt_hdr (lch_nomor, lch_tanggal, lch_gdg_prod, lch_shift, lch_operator)
                VALUES (?, ?, ?, ?, ?)
            `, [finalNomor, formattedDate, headerData.lch_gdg_prod, headerData.lch_shift, headerData.lch_operator]);
        }

        for (let i = 0; i < detailsData.length; i++) {
            const d = detailsData[i];
            await conn.query(`
                INSERT INTO tlhk_cetakmmt_dtl (
                    lcd_lch_nomor, lcd_no_urut, lcd_lnomor, lcd_spk_nomor, 
                    lcd_qty_Cetak, lcd_jns_mesin, lcd_loperator, lcd_lshift
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                finalNomor, 
                i + 1, 
                d.Nomor_lhk_mesin || d.lhkmesin, 
                d.Nomor_SPK || d.spk_nomor, 
                d.Jml_Cetak || d.jumlah_cetak, 
                d.Mesin || d.mesin, 
                d.Operator || d.operator, 
                d.Shift || d.shift
            ]);
        }

        await conn.commit();
        return { success: true, nomor: finalNomor };
    } catch (err) {
        await conn.rollback();
        console.error("Detail Error Simpan:", err);
        throw err;
    } finally {
        conn.release();
    }
};

const deleteLhk = async (nomor) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
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