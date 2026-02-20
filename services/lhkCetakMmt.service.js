const pool = require('../config/db.config'); 
const { format } = require('date-fns');

const NOMERATOR = 'MMT-LHK-C';

// =========================================================================
// 1. FUNGSI READ (GET)
// =========================================================================

const getAllHeaders = async (startDate, endDate, mesin) => {
    // 1. Format tanggal untuk MySQL
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    let params = [tglMulai, tglSelesai];
    let mesinFilterSql = "";

    // 2. Logika filter mesin (jika ada)
    if (mesin) {
        // Jika mesin dikirim sebagai string "MT01,MT02", ubah jadi array
        const mesinArray = Array.isArray(mesin) ? mesin : mesin.split(',').filter(m => m.trim() !== '');
        
        if (mesinArray.length > 0) {
            // Menggunakan EXISTS agar satu Nomor LHK hanya muncul satu kali (DISTINCT secara implisit)
            // meskipun memiliki banyak baris detail yang cocok
            mesinFilterSql = `
                AND EXISTS (
                    SELECT 1 FROM tlhk_cetakmmt_dtl dtl 
                    WHERE dtl.lcd_lch_nomor = h.lch_nomor 
                    AND dtl.lcd_jns_mesin IN (${mesinArray.map(() => '?').join(',')})
                )
            `;
            params.push(...mesinArray);
        }
    }

    const sql = `
        SELECT 
            lch_nomor AS Nomor, 
            DATE_FORMAT(lch_tanggal, '%Y-%m-%d') AS Tanggal, 
            lch_gdg_prod AS Gudang, 
            g.gdg_nama AS Nama_Gudang, 
            lch_shift AS Shift, 
            lch_operator AS Operator,
            (SELECT IF(COUNT(*) > COUNT(IF(LENGTH(lcd_brg_kode)>0, 1, NULL)), 'N','Y') 
             FROM tlhk_cetakmmt_dtl WHERE lcd_lch_nomor = lch_nomor) AS Lengkap,
            (SELECT SUM(lcd_qty_Cetak * IFNULL(spk_panjang,0) * IFNULL(spk_lebar,0)) 
             FROM tlhk_cetakmmt_dtl 
             LEFT JOIN tspk ON (spk_nomor = lcd_spk_nomor)
             WHERE lcd_lch_nomor = lch_nomor) AS cetak_meter
        FROM tlhk_cetakmmt_hdr h
        LEFT JOIN tGUDANG g ON (g.gdg_kode = h.lch_gdg_prod)
        WHERE h.lch_tanggal BETWEEN ? AND ?
        ${mesinFilterSql}
        ORDER BY h.lch_tanggal DESC, h.lch_nomor DESC
    `;

    const [rows] = await pool.query(sql, params);
    return rows;
};

// Tambahkan parameter mesin
const getDetailsByNomor = async (nomor, mesin) => {
    let params = [nomor];
    let filterMesin = "";

    if (mesin) {
        const mesinArray = Array.isArray(mesin) ? mesin : mesin.split(',').filter(m => m.trim() !== '');
        if (mesinArray.length > 0) {
            filterMesin = ` AND d.lcd_jns_mesin IN (${mesinArray.map(() => '?').join(',')})`;
            params.push(...mesinArray);
        }
    }

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
            /* RUMUS: Panjang x Lebar x Qty Cetak */
            (IFNULL(x.spk_panjang, 0) * IFNULL(x.spk_lebar, 0) * d.lcd_qty_cetak) AS m2_cetak,
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
        ${filterMesin}
        ORDER BY d.lcd_no_urut ASC
    `;
    const [rows] = await pool.query(sqlDetail, params);
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

        // --- LOGIKA GABUNG OPERATOR UNIK ---
        // Mengambil semua nama operator dari detail, filter yang kosong, lalu ambil yang unik
        const uniqueOperators = [...new Set(detailsData.map(d => (d.Operator || d.operator || '').trim()).filter(name => name !== ''))];
        const combinedOperators = uniqueOperators.join(', ');

        const rawDate = headerData.lch_tanggal; 
        const dateToUse = (rawDate && !isNaN(new Date(rawDate).getTime())) 
            ? new Date(rawDate) 
            : new Date();

        if (!isEditMode) {
            finalNomor = await generateNewNomor(dateToUse);
        }

        const formattedDate = format(dateToUse, 'yyyy-MM-dd');
        // Ambil user dari payload luser_modified yang dikirim frontend
        const currentUser = headerData.luser_modified || 'SYSTEM';

        if (isEditMode) {
            await conn.query(`
                UPDATE tlhk_cetakmmt_hdr SET
                    lch_tanggal = ?, lch_gdg_prod = ?, lch_shift = ?, 
                    lch_operator = ?, lch_user_edit = ?, lch_date_edit = NOW()
                WHERE lch_nomor = ?
            `, [formattedDate, headerData.lch_gdg_prod, headerData.lch_shift, combinedOperators, currentUser, finalNomor]);
            
            await conn.query(`DELETE FROM tlhk_cetakmmt_dtl WHERE lcd_lch_nomor = ?`, [finalNomor]);
        } else {
            await conn.query(`
                INSERT INTO tlhk_cetakmmt_hdr (
                    lch_nomor, lch_tanggal, lch_gdg_prod, lch_shift, 
                    lch_operator, lch_user_create, lch_date_create
                )
                VALUES (?, ?, ?, ?, ?, ?, NOW())
            `, [finalNomor, formattedDate, headerData.lch_gdg_prod, headerData.lch_shift, combinedOperators, currentUser]);
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

// =========================================================================
// 4. FUNGSI LAPORAN (AGREGASI)
// =========================================================================

const getLaporanAgregasi = async (startDate, endDate) => {
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    // 1. Per Mesin (Total m2 per mesin)
    const sqlMesin = `
        SELECT d.lcd_jns_mesin as Mesin, SUM(d.lcd_qty_Cetak * IFNULL(s.spk_panjang,0) * IFNULL(s.spk_lebar,0)) as Total_m2
        FROM tlhk_cetakmmt_dtl d
        LEFT JOIN tlhk_cetakmmt_hdr h ON d.lcd_lch_nomor = h.lch_nomor
        LEFT JOIN tspk s ON d.lcd_spk_nomor = s.spk_nomor
        WHERE h.lch_tanggal BETWEEN ? AND ?
        GROUP BY d.lcd_jns_mesin
    `;

    // 2. Per Hari (Tren produksi)
    const sqlHarian = `
        SELECT DATE_FORMAT(lch_tanggal, '%Y-%m-%d') as Tanggal, 
               SUM(lcd_qty_Cetak * IFNULL(spk_panjang,0) * IFNULL(spk_lebar,0)) as Total_m2
        FROM tlhk_cetakmmt_hdr h
        JOIN tlhk_cetakmmt_dtl d ON h.lch_nomor = d.lcd_lch_nomor
        LEFT JOIN tspk s ON d.lcd_spk_nomor = s.spk_nomor
        WHERE h.lch_tanggal BETWEEN ? AND ?
        GROUP BY h.lch_tanggal
        ORDER BY h.lch_tanggal ASC
    `;

    // 3. Per SPK (Top 10 SPK terbanyak dikerjakan)
    const sqlSPK = `
        SELECT d.lcd_spk_nomor, s.spk_nama, SUM(d.lcd_qty_Cetak) as Total_Qty,
               SUM(d.lcd_qty_Cetak * IFNULL(s.spk_panjang,0) * IFNULL(s.spk_lebar,0)) as Total_m2
        FROM tlhk_cetakmmt_dtl d
        LEFT JOIN tspk s ON d.lcd_spk_nomor = s.spk_nomor
        LEFT JOIN tlhk_cetakmmt_hdr h ON d.lcd_lch_nomor = h.lch_nomor
        WHERE h.lch_tanggal BETWEEN ? AND ?
        GROUP BY d.lcd_spk_nomor, s.spk_nama
        ORDER BY Total_m2 DESC
        LIMIT 10
    `;

    const [resMesin] = await pool.query(sqlMesin, [tglMulai, tglSelesai]);
    const [resHarian] = await pool.query(sqlHarian, [tglMulai, tglSelesai]);
    const [resSPK] = await pool.query(sqlSPK, [tglMulai, tglSelesai]);

    return { perMesin: resMesin, perHari: resHarian, perSPK: resSPK };
};

// Tambahkan pengecekan sederhana di awal fungsi laporan
const getRekapLhk = async (startDate, endDate) => {
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    // 1. Rekap Per Mesin (Tetap sama)
    const sqlMesin = `
        SELECT 
            d.lcd_jns_mesin AS Mesin,
            COUNT(DISTINCT d.lcd_spk_nomor) AS Jml_SPK,
            SUM(d.lcd_qty_Cetak) AS Total_Pcs,
            SUM(d.lcd_qty_Cetak * IFNULL(s.spk_panjang,0) * IFNULL(s.spk_lebar,0)) AS Total_Meter
        FROM tlhk_cetakmmt_dtl d
        JOIN tlhk_cetakmmt_hdr h ON d.lcd_lch_nomor = h.lch_nomor
        LEFT JOIN (
            SELECT spk_nomor, spk_panjang, spk_lebar FROM tspk
            UNION ALL
            SELECT mspk_nomor, mspk_panjang, mspk_lebar FROM tmemospk
        ) s ON s.spk_nomor = d.lcd_spk_nomor
        WHERE h.lch_tanggal BETWEEN ? AND ?
        GROUP BY d.lcd_jns_mesin
    `;

    // 2. PERBAIKAN: Rekap Per Hari + Mesin agar Excel Terisi
    const sqlHarian = `
        SELECT 
            d.lcd_jns_mesin AS Mesin,
            DATE_FORMAT(h.lch_tanggal, '%Y-%m-%d') AS Tanggal,
            SUM(d.lcd_qty_Cetak * IFNULL(s.spk_panjang,0) * IFNULL(s.spk_lebar,0)) AS Total_Meter
        FROM tlhk_cetakmmt_hdr h
        JOIN tlhk_cetakmmt_dtl d ON d.lcd_lch_nomor = h.lch_nomor
        LEFT JOIN (
            SELECT spk_nomor, spk_panjang, spk_lebar FROM tspk
            UNION ALL
            SELECT mspk_nomor, mspk_panjang, mspk_lebar FROM tmemospk
        ) s ON s.spk_nomor = d.lcd_spk_nomor
        WHERE h.lch_tanggal BETWEEN ? AND ?
        GROUP BY d.lcd_jns_mesin, h.lch_tanggal
        ORDER BY h.lch_tanggal ASC, d.lcd_jns_mesin ASC
    `;

    const [rekapMesin] = await pool.query(sqlMesin, [tglMulai, tglSelesai]);
    const [rekapHarian] = await pool.query(sqlHarian, [tglMulai, tglSelesai]);

    return { rekapMesin, rekapHarian };
};

const getExportLhkCrossTab = async (month, year) => {
    // Menghasilkan data rekap per mesin per tanggal dalam bulan tersebut
    const sql = `
        SELECT 
            d.lcd_jns_mesin AS Mesin,
            DAY(h.lch_tanggal) AS Hari,
            SUM(d.lcd_qty_Cetak * IFNULL(s.spk_panjang,0) * IFNULL(s.spk_lebar,0)) AS Total_Meter
        FROM tlhk_cetakmmt_dtl d
        JOIN tlhk_cetakmmt_hdr h ON d.lcd_lch_nomor = h.lch_nomor
        LEFT JOIN (
            SELECT spk_nomor, spk_panjang, spk_lebar FROM tspk
            UNION ALL
            SELECT mspk_nomor, mspk_panjang, mspk_lebar FROM tmemospk
        ) s ON s.spk_nomor = d.lcd_spk_nomor
        WHERE MONTH(h.lch_tanggal) = ? AND YEAR(h.lch_tanggal) = ?
        GROUP BY d.lcd_jns_mesin, DAY(h.lch_tanggal)
    `;

    const [rows] = await pool.query(sql, [month, year]);
    return rows;
};

// backend/services/lhkCetakMmt.service.js

const getDetailRekapMesin = async (startDate, endDate, mesin) => {
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    const sql = `
        SELECT 
            d.lcd_spk_nomor AS No_SPK,
            s.spk_nama AS Nama_Order,
            SUM(d.lcd_qty_Cetak) AS Total_Pcs,
            SUM(d.lcd_qty_Cetak * IFNULL(s.spk_panjang,0) * IFNULL(s.spk_lebar,0)) AS Total_Meter
        FROM tlhk_cetakmmt_dtl d
        JOIN tlhk_cetakmmt_hdr h ON d.lcd_lch_nomor = h.lch_nomor
        LEFT JOIN (
            SELECT spk_nomor, spk_nama, spk_panjang, spk_lebar FROM tspk
            UNION ALL
            SELECT mspk_nomor, mspk_nama, mspk_panjang, mspk_lebar FROM tmemospk
        ) s ON s.spk_nomor = d.lcd_spk_nomor
        WHERE h.lch_tanggal BETWEEN ? AND ?
          AND d.lcd_jns_mesin = ?
        GROUP BY d.lcd_spk_nomor, s.spk_nama
        ORDER BY Total_Meter DESC
    `;

    const [rows] = await pool.query(sql, [tglMulai, tglSelesai, mesin]);
    return rows;
};

const getAllDataForExport = async (startDate, endDate, mesin) => {
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    let params = [tglMulai, tglSelesai];
    let filterMesin = "";

    if (mesin) {
        const mesinArray = Array.isArray(mesin) ? mesin : mesin.split(',').filter(m => m.trim() !== '');
        if (mesinArray.length > 0) {
            filterMesin = ` AND d.lcd_jns_mesin IN (${mesinArray.map(() => '?').join(',')})`;
            params.push(...mesinArray);
        }
    }

    const sql = `
        SELECT 
            h.lch_nomor AS Nomor_LHK,
            DATE_FORMAT(h.lch_tanggal, '%d/%m/%Y') AS Tanggal,
            h.lch_shift AS Shift_LHK,
            h.lch_operator AS Operator_LHK,
            g.gdg_nama AS Gudang,
            d.lcd_spk_nomor AS Nomor_SPK,
            x.spk_nama AS Nama_Order,
            d.lcd_jns_mesin AS Mesin,
            d.lcd_qty_cetak AS Qty_Cetak,
            IFNULL(x.spk_panjang, 0) AS Panjang,
            IFNULL(x.spk_lebar, 0) AS Lebar,
            (IFNULL(x.spk_panjang, 0) * IFNULL(x.spk_lebar, 0) * d.lcd_qty_cetak) AS m2_cetak
        FROM tlhk_cetakmmt_hdr h
        JOIN tlhk_cetakmmt_dtl d ON h.lch_nomor = d.lcd_lch_nomor
        LEFT JOIN tGUDANG g ON g.gdg_kode = h.lch_gdg_prod
        LEFT JOIN (
            SELECT spk_nomor, spk_nama, spk_panjang, spk_lebar FROM tspk
            UNION ALL
            SELECT mspk_nomor, mspk_nama, mspk_panjang, mspk_lebar FROM tmemospk
        ) x ON x.spk_nomor = d.lcd_spk_nomor
        WHERE h.lch_tanggal BETWEEN ? AND ?
        ${filterMesin}
        ORDER BY h.lch_tanggal DESC, h.lch_nomor DESC, d.lcd_no_urut ASC
    `;

    const [rows] = await pool.query(sql, params);
    return rows;
};

module.exports = {
    getAllHeaders,
    getDetailsByNomor,
    generateNewNomor,
    saveLhk,
    deleteLhk,
    getLaporanAgregasi,
    getRekapLhk,
    getExportLhkCrossTab,
    getDetailRekapMesin,
    getAllDataForExport




};