
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
 * @param {string} search - Kata kunci pencarian (Nama SPK / Nomor)
 */

const getAllHeaders = async (startDate, endDate, search = '') => {
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');
    
    const params = [tglMulai, tglSelesai];

    let sql = `
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
            
            -- Ambil data dari subquery x
            IFNULL(x.qtytotalcetak, 0) AS TotalCetak,
            IFNULL(x.panjang_bahan_awal, 0) AS PanjangBahanAwal,
            IFNULL(x.sisa_akhir, 0) AS SisaMeterAkhir,
            
            -- Logika Surplus/Minus: 
            -- Jika sisa_akhir < 0, berarti surplus pemakaian (bahan lebih panjang dari label)
            -- Kita tampilkan nilai positif dari minus tersebut sebagai angka surplus
            CASE 
                WHEN x.sisa_akhir < 0 THEN ABS(x.sisa_akhir)
                ELSE 0 
            END AS NilaiSurplus,
            
            CASE 
                WHEN x.sisa_akhir > 0 THEN x.sisa_akhir
                ELSE 0 
            END AS NilaiMinus,

            t1.lbarcode_roll AS Kode_bahan,
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
                -- Total hasil cetak semua baris
                SUM(ld_qtyCetak1 + ld_qtyCetak2 + ld_qtyCetak3 + ld_qtyCetak4 + ld_qtyCetak5 + ld_qtyCetak6 + ld_qtyCetak7) AS qtytotalcetak,
                -- Ambil ld_ambilbahan dari urutan pertama (asumsi panjang roll awal)
                MAX(ld_ambilbahan) AS panjang_bahan_awal,
                -- Ambil sisa terakhir dari baris terakhir (urut terbesar)
                (SELECT ld_sisameter FROM tlhk_mesin_dtl d2 
                 WHERE d2.ld_lnomor = tlhk_mesin_dtl.ld_lnomor 
                 ORDER BY ld_urut DESC LIMIT 1) AS sisa_akhir
            FROM tlhk_mesin_dtl 
            GROUP BY ld_lnomor
        ) x ON x.ld_lnomor = t1.lnomor
        WHERE t1.ltanggal BETWEEN ? AND ?
    `;

    if (search) {
        // MENAMBAHKAN PENCARIAN BAHAN DAN BARCODE DI SINI
        sql += ` AND (
            t2.spk_nama LIKE ? 
            OR t1.lnomor LIKE ? 
            OR t1.lspk_nomor LIKE ? 
            OR t3.brg_nama LIKE ? 
            OR t1.lbarcode_roll LIKE ?
        ) `;
        const searchPattern = `%${search}%`;
        // Tambahkan parameter sesuai jumlah tanda tanya (?) baru
        params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    sql += ` ORDER BY t1.ltanggal DESC, t1.lnomor DESC`;

    const [rows] = await pool.query(sql, params);
    return rows;
};


const getLookup = async (startDate, endDate, shift = '', search = '') => {
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');
    
    const params = [tglMulai, tglSelesai];

    let sql = `
        SELECT 
            t1.lnomor AS Nomor, 
            t1.lshift AS Shift, 
            t1.ltanggal AS Tanggal, 
            t1.lmesin AS Mesin, 
            t1.lspk_nomor AS NomorSPK, 
            t2.spk_nama AS NamaOrder,
            IFNULL(t2.spk_jumlah,0) AS JumlahOrder,
            IFNULL(x.qtytotalcetak, 0) AS TotalCetak,
            /* RUMUS KURANG CETAK */
            CAST(GREATEST(0, IFNULL(t2.spk_jumlah, 0) - IFNULL(all_prod.total_pernah_cetak, 0)) AS UNSIGNED) AS KurangCetak,
            t1.loperator AS Operator,
            
            /* --- PENAMBAHAN STATUS AMBIL --- */
            IF(rekap.lcd_lnomor IS NOT NULL, 'CLOSED', 'OPEN') AS StatusAmbil
            
        FROM tlhk_mesin_hdr t1
        LEFT JOIN tspk t2 ON t2.spk_nomor = t1.lspk_nomor
        LEFT JOIN (
            SELECT 
                ld_lnomor,
                SUM(ld_qtyCetak1 + ld_qtyCetak2 + ld_qtyCetak3 + ld_qtyCetak4 + ld_qtyCetak5 + ld_qtyCetak6 + ld_qtyCetak7) AS qtytotalcetak
            FROM tlhk_mesin_dtl 
            GROUP BY ld_lnomor
        ) x ON x.ld_lnomor = t1.lnomor
        /* Subquery untuk menghitung total produksi SPK ini dari semua LHK yang pernah ada */
        LEFT JOIN (
            SELECT h.lspk_nomor, SUM(d.ld_qtyCetak1 + d.ld_qtyCetak2 + d.ld_qtyCetak3 + d.ld_qtyCetak4 + d.ld_qtyCetak5 + d.ld_qtyCetak6 + d.ld_qtyCetak7) as total_pernah_cetak
            FROM tlhk_mesin_hdr h
            JOIN tlhk_mesin_dtl d ON h.lnomor = d.ld_lnomor
            GROUP BY h.lspk_nomor
        ) all_prod ON all_prod.lspk_nomor = t1.lspk_nomor
        
        /* --- JOIN UNTUK CEK APAKAH NOMOR LHK INI SUDAH PERNAH DI REKAP --- */
        LEFT JOIN (
            SELECT DISTINCT lcd_lnomor 
            FROM tlhk_cetakmmt_dtl
        ) rekap ON rekap.lcd_lnomor = t1.lnomor

        WHERE t1.ltanggal BETWEEN ? AND ?
    `;

    if (shift) {
        sql += ` AND t1.lshift = ? `;
        params.push(shift);
    }

    if (search) {
        sql += ` AND (t2.spk_nama LIKE ? OR t1.lnomor LIKE ? OR t1.lspk_nomor LIKE ?) `;
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
    }

    sql += ` ORDER BY t1.ltanggal DESC, t1.lnomor DESC`;

    const [rows] = await pool.query(sql, params);
    return rows;
};


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

        // --- PERBAIKAN: Tambahkan J_Cetak1 s/d J_Cetak7 ---
        const sqlDetail = `
            SELECT 
                d.ld_lnomor AS lhkmesin,
                d.ld_spk_nomor AS spk_nomor,
                s.spk_nama AS nama_spk,
                t1.lshift AS shift,
                t1.loperator AS operator,
                t1.lmesin AS mesin,
                s.spk_jumlah AS jumlah,
                IFNULL(akumulasi.total_cetak, 0) AS sudahcetak,
                d.ld_total_qtycetak AS totalcetak,
                ROUND(IFNULL(s.spk_panjang, 0) * IFNULL(s.spk_lebar, 0) * IFNULL(d.ld_total_qtycetak, 0), 2) AS m2_cetak,
                s.spk_panjang,
                s.spk_lebar,
                d.ld_padding AS Padding,
                d.ld_tile AS Tile,
                -- Field Cetak 1 - 7
                d.ld_qtyCetak1 AS J_Cetak1,
                d.ld_qtyCetak2 AS J_Cetak2,
                d.ld_qtyCetak3 AS J_Cetak3,
                d.ld_qtyCetak4 AS J_Cetak4,
                d.ld_qtyCetak5 AS J_Cetak5,
                d.ld_qtyCetak6 AS J_Cetak6,
                d.ld_qtyCetak7 AS J_Cetak7
            FROM tlhk_mesin_dtl d
            INNER JOIN tlhk_mesin_hdr t1 ON t1.lnomor = d.ld_lnomor
            LEFT JOIN tspk s ON s.spk_nomor = d.ld_spk_nomor
            LEFT JOIN (
                SELECT ld_spk_nomor, SUM(ld_total_qtycetak) as total_cetak 
                FROM tlhk_mesin_dtl 
                GROUP BY ld_spk_nomor
            ) akumulasi ON akumulasi.ld_spk_nomor = d.ld_spk_nomor
            WHERE d.ld_lnomor = ?
            ORDER BY d.ld_urut ASC
        `;
        const [detailRows] = await pool.query(sqlDetail, [nomor]);

        return {
            header: headerRows[0],
            details: detailRows
        };

    } catch (error) {
        console.error("Error getLookupByNomor:", error);
        throw new Error(`Gagal mengambil data LHK Cetak: ${error.message}`);
    }
};

/**
 * Mengambil data dari MULTIPLE Nomor LHK Mesin (Multiple Choice)
 * @param {Array|string} nomor - Bisa berupa string tunggal atau Array nomor ['LHK01', 'LHK02']
 */
const getLookupByMultipleNomor = async (nomor) => {
    try {
        // 1. Pastikan input adalah array
        const daftarNomor = Array.isArray(nomor) ? nomor : [nomor];
        if (daftarNomor.length === 0) return null;

        // 2. Query Header
        const sqlHeader = `
            SELECT 
                t1.lmesin AS Mesin, 
                t1.lbarcode_roll,
                t1.loperator AS Operator,
                t1.lgdg_prod AS Gudang,
                t1.lbahan AS Kode_bahan,
                t3.brg_nama AS nama_Bahan,
                t1.lpanjang_terpakai,
                t1.ljumlah_kolom AS Tile
            FROM tlhk_mesin_hdr t1
            LEFT JOIN tbarang_mmt t3 ON t3.brg_kode = t1.lbahan
            WHERE t1.lnomor IN (?)
            LIMIT 1
        `;
        
        const [headerRows] = await pool.query(sqlHeader, [daftarNomor]);

        // 3. Query Detail (Perbaikan Koma & Penambahan Perhitungan m2)
        const sqlDetail = `
            SELECT 
                d.ld_lnomor AS referensi_lhk,
                h.lmesin AS mesin,
                h.loperator AS operator,
                h.lshift AS shift,
                d.ld_spk_nomor AS spk_nomor,
                s.spk_nama AS nama_spk,
                s.spk_jumlah AS jumlah_order,
                d.ld_qtyCetak1, d.ld_qtyCetak2, d.ld_qtyCetak3, 
                d.ld_qtyCetak4, d.ld_qtyCetak5, d.ld_qtyCetak6, d.ld_qtyCetak7,
                d.ld_total_qtycetak AS totalcetak,
                d.ld_total_metercetak AS cetakmeter,
                d.ld_tile AS tile,
                -- Perhitungan m2: Panjang * Lebar * Qty (Asumsi meter)
                ROUND(IFNULL(s.spk_panjang, 0) * IFNULL(s.spk_lebar, 0) * IFNULL(d.ld_total_qtycetak, 0), 2) AS ld_luas_m2
            FROM tlhk_mesin_dtl d
            INNER JOIN tlhk_mesin_hdr h ON h.lnomor = d.ld_lnomor
            LEFT JOIN tspk s ON s.spk_nomor = d.ld_spk_nomor
            WHERE d.ld_lnomor IN (?)
            ORDER BY d.ld_lnomor ASC, d.ld_urut ASC
        `;
        
        const [detailRows] = await pool.query(sqlDetail, [daftarNomor]);

        return {
            header: headerRows.length > 0 ? headerRows[0] : {},
            details: detailRows,
            summary: {
                total_meter_gabungan: detailRows.reduce((sum, item) => sum + Number(item.cetakmeter || 0), 0),
                jumlah_lhk_terpilih: daftarNomor.length
            }
        };

    } catch (error) {
        console.error("Error getLookupByMultipleNomor:", error);
        throw new Error(`Gagal mengambil data multiple LHK: ${error.message}`);
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

    // Helper Fungsi untuk menentukan kategori berdasarkan dimensi
    const getKategori = (panjang, lebar) => {
        // ROLL jika panjang >= 3 meter DAN lebar >= 0.5 meter. Selain itu SCRAP.
        if (panjang >= 3 && lebar >= 0.5) {
            return 'ROLL';
        }
        return 'SCRAP';
    };

    try {
        await conn.beginTransaction();

        const now = new Date();
        const dateToUse = headerData.ltanggal ? new Date(headerData.ltanggal) : now;
        const formattedDate = format(dateToUse, 'yyyy-MM-dd');
        const formattedNow = format(now, 'yyyy-MM-dd HH:mm:ss');
        const userCreate = headerData.luser_create || 'SYSTEM';
        const userModified = headerData.luser_modified || userCreate;

        const uniqueSpks = [...new Set(detailsData.map(d => d.nomor_spk).filter(s => s))];
        const combinedSpkNomor = uniqueSpks.join(', ');

        if (!isEditMode) {
            finalNomor = await generateNewNomor(dateToUse);
        }

        const totalPanjangTerpakai = detailsData.reduce((sum, d) => sum + Number(d.cetakmeter || 0), 0);

        // --- VALIDASI AWAL: CEK PANJANG AMBIL BAHAN ---
        const checkMaxPanjang = detailsData.reduce((max, d) => Math.max(max, Number(d.ambilBahanPanjang || 0)), 0);
        
        if (currentStatus === 'POSTED' && checkMaxPanjang <= 0) {
            throw new Error("Gagal Simpan: Panjang bahan yang diambil tidak boleh 0. Scan ulang barcode material.");
        }

        if (isEditMode) {
            // ==================== PROSES LOGGING DATA LAMA ====================
            // 1. Ambil snapshot data yang saat ini ada di DB sebelum ditimpa/dihapus
            const [oldHeader] = await conn.query(`SELECT * FROM tlhk_mesin_hdr WHERE lnomor = ?`, [finalNomor]);
            const [oldDetails] = await conn.query(`SELECT * FROM tlhk_mesin_dtl WHERE ld_lnomor = ?`, [finalNomor]);
            const [oldStock] = await conn.query(`SELECT * FROM tmasterstok_mmt WHERE mst_noreferensi = ?`, [finalNomor]);

            if (oldHeader.length > 0) {
                // Bungkus semua data lama ke dalam satu object
                const snapshotDataLama = {
                    header: oldHeader[0],
                    details: oldDetails,
                    stock: oldStock
                };

                // 2. Simpan snapshot tersebut ke tabel log baru
                await conn.query(`
                    INSERT INTO tlhk_history_log (
                        lhl_nomor_lhk, lhl_action, lhl_data_old, lhl_user_action, lhl_date_action
                    ) VALUES (?, 'EDIT', ?, ?, ?)
                `, [
                    finalNomor,
                    JSON.stringify(snapshotDataLama), // Diubah ke string JSON
                    userModified,
                    formattedNow
                ]);
            }
            // ==================================================================

            // Melanjutkan proses update bawaan kamu
            await conn.query(`
                UPDATE tlhk_mesin_hdr SET
                    ltanggal = ?, lgdg_prod = ?, lspk_nomor = ?, lmesin = ?,
                    lshift = ?, loperator = ?, lbahan = ?, lbarcode_roll = ?,
                    lpanjang_terpakai = ?, ljumlah_kolom = ?, lfixed = 'Y',
                    ldate_modified = ?, luser_modified = ?, lstatus = ?,
                    lpanjang_bs = ?, llebar_bs = ?, lpanjang_afal = ?, llebar_afal = ?
                WHERE lnomor = ?
            `, [
                formattedDate, headerData.lgdg_prod, combinedSpkNomor, headerData.lmesin,
                headerData.lshift, headerData.loperator, headerData.lbahan, headerData.lbarcode_roll,
                totalPanjangTerpakai, headerData.ljumlah_kolom, 
                formattedNow, userModified, currentStatus,
                headerData.lpanjang_bs || 0, headerData.llebar_bs || 0,
                headerData.lpanjang_afal || 0, headerData.llebar_afal || 0,
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
                headerData.lshift, headerData.loperator, formattedNow, userCreate,
                headerData.lbahan, headerData.lbarcode_roll, totalPanjangTerpakai,
                headerData.ljumlah_kolom, currentStatus,
                headerData.lpanjang_bs || 0, headerData.llebar_bs || 0, 
                headerData.lpanjang_afal || 0, headerData.llebar_afal || 0
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

        if (currentStatus === 'POSTED') {
            if (usedBarcode && maxAmbilPanjang > 0) {
                const [oldStockData] = await conn.query(`
                    SELECT mst_hargabeli, mst_satuan_harga, mst_lebar 
                    FROM tmasterstok_mmt 
                    WHERE mst_barcode = ? 
                    LIMIT 1
                `, [usedBarcode]);

                const hargaBeliLama = oldStockData.length > 0 ? oldStockData[0].mst_hargabeli : 0;
                const satuanHargaLama = oldStockData.length > 0 ? oldStockData[0].mst_satuan_harga : null;
                const lebarAwal = oldStockData.length > 0 ? oldStockData[0].mst_lebar : 0;

                const finalLebarInput = (finalSisaLebar > 0) ? finalSisaLebar : lebarAwal;
                const initialLebar = detailsData[0].ambilBahanLebar || lebarAwal;

                // 1. MUTASI KELUAR (STOK LAMA HABIS)
                await conn.query(`
                    INSERT INTO tmasterstok_mmt (
                        mst_brg_kode, mst_gdg_kode, mst_stok_in, mst_stok_out,
                        mst_panjang, mst_lebar, mst_spk_nomor, mst_noreferensi,
                        mst_hargabeli, mst_satuan_harga, mst_tanggal, mst_barcode, mst_kategori
                    ) VALUES (?, ?, 0, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'ROLL')
                `, [
                    usedKodeBahan, headerData.lgdg_prod, maxAmbilPanjang, initialLebar, 
                    combinedSpkNomor, finalNomor, hargaBeliLama, satuanHargaLama, formattedDate, usedBarcode
                ]);

                // 2. MUTASI MASUK (SISA UTAMA)
                if (finalSisaMeter > 0) {
                    const kategoriSisa = getKategori(finalSisaMeter, finalLebarInput);
                    await conn.query(`
                        INSERT INTO tmasterstok_mmt (
                            mst_brg_kode, mst_gdg_kode, mst_stok_in, mst_stok_out,
                            mst_panjang, mst_lebar, mst_spk_nomor, mst_noreferensi,
                            mst_hargabeli, mst_satuan_harga, mst_tanggal, mst_barcode,
                            mst_kategori
                        ) VALUES (?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        usedKodeBahan, headerData.lgdg_prod, finalSisaMeter, finalLebarInput, 
                        combinedSpkNomor, finalNomor, hargaBeliLama, satuanHargaLama, formattedDate, usedBarcode,
                        kategoriSisa
                    ]);
                }

                // 3. MUTASI MASUK (AFAL SISTEM)
                const afalP = headerData.lpanjang_afal || 0; 
                const afalL = headerData.llebar_afal || 0;

                if (afalP > 0 && afalL > 0) {
                    const kategoriAfal = getKategori(afalP, afalL);
                    const newAfalBarcode = await getNextSuffix(conn, usedBarcode);
                    
                    await conn.query(`
                        INSERT INTO tmasterstok_mmt (
                            mst_brg_kode, mst_gdg_kode, mst_stok_in, mst_stok_out,
                            mst_panjang, mst_lebar, mst_spk_nomor, mst_noreferensi,
                            mst_hargabeli, mst_satuan_harga, mst_tanggal, mst_barcode,
                            mst_kategori
                        ) VALUES (?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        usedKodeBahan, headerData.lgdg_prod, afalP, afalL, 
                        "STOK AFAL", finalNomor, hargaBeliLama, satuanHargaLama, formattedDate, newAfalBarcode,
                        kategoriAfal
                    ]);
                }
            }
        }
        await conn.commit();
        return { success: true, nomor: finalNomor, status: currentStatus };

    } catch (err) {
        if (conn) await conn.rollback();
        console.error("Error Save LHK:", err);
        throw new Error(err.message || "Gagal Simpan LHK");
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

// =========================================================================
// 2. FUNGSI LAPORAN & AGREGASI (tlhk_mesin_hdr & tlhk_mesin_dtl)
// =========================================================================

/**
 * Mendapatkan ringkasan statistik produksi untuk Dashboard
 */
const getLaporanAgregasi = async (startDate, endDate) => {
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    // 1. Per Mesin (Total m2 per mesin)
    const sqlMesin = `
        SELECT h.lmesin as Mesin, SUM(d.ld_luas_m2) as Total_m2
        FROM tlhk_mesin_dtl d
        JOIN tlhk_mesin_hdr h ON d.ld_lnomor = h.lnomor
        WHERE h.ltanggal BETWEEN ? AND ?
        GROUP BY h.lmesin
    `;

    // 2. Per Hari (Tren produksi)
    const sqlHarian = `
        SELECT DATE_FORMAT(h.ltanggal, '%Y-%m-%d') as Tanggal, 
               SUM(d.ld_luas_m2) as Total_m2
        FROM tlhk_mesin_hdr h
        JOIN tlhk_mesin_dtl d ON h.lnomor = d.ld_lnomor
        WHERE h.ltanggal BETWEEN ? AND ?
        GROUP BY h.ltanggal
        ORDER BY h.ltanggal ASC
    `;

    // 3. Per SPK (Top 10 SPK terbanyak dikerjakan)
    const sqlSPK = `
        SELECT d.ld_spk_nomor as lcd_spk_nomor, s.spk_nama, 
               SUM(d.ld_total_qtycetak) as Total_Qty,
               SUM(d.ld_luas_m2) as Total_m2
        FROM tlhk_mesin_dtl d
        LEFT JOIN tspk s ON d.ld_spk_nomor = s.spk_nomor
        JOIN tlhk_mesin_hdr h ON d.ld_lnomor = h.lnomor
        WHERE h.ltanggal BETWEEN ? AND ?
        GROUP BY d.ld_spk_nomor, s.spk_nama
        ORDER BY Total_m2 DESC
        LIMIT 10
    `;

    const [resMesin] = await pool.query(sqlMesin, [tglMulai, tglSelesai]);
    const [resHarian] = await pool.query(sqlHarian, [tglMulai, tglSelesai]);
    const [resSPK] = await pool.query(sqlSPK, [tglMulai, tglSelesai]);

    return { perMesin: resMesin, perHari: resHarian, perSPK: resSPK };
};

/**
 * Rekap LHK untuk tampilan tabel report
 */
const getRekapLhk = async (startDate, endDate) => {
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    // 1. Rekap Per Mesin (Ditambah Join ke Master Mesin)
    const sqlMesin = `
        SELECT 
            d.lcd_jns_mesin AS Mesin,
            COUNT(DISTINCT d.lcd_spk_nomor) AS Jml_SPK,
            SUM(d.lcd_qty_Cetak) AS Total_Pcs,
            ROUND(SUM(d.lcd_qty_Cetak * IFNULL(s.spk_panjang, 0) * IFNULL(s.spk_lebar, 0)), 1) AS Total_Meter,
            /* Ambil Kapasitas dari tabel master mesin */
            IFNULL(m.msn_kapasitas, 0) AS Kapasitas 
        FROM tlhk_cetakmmt_dtl d
        INNER JOIN tlhk_cetakmmt_hdr h ON d.lcd_lch_nomor = h.lch_nomor
        LEFT JOIN tspk s ON s.spk_nomor = d.lcd_spk_nomor
        /* JOIN ke tabel master mesin berdasarkan kode/nama mesin */
        LEFT JOIN tmesin_mmt m ON m.msn_nama = d.lcd_jns_mesin 
        WHERE h.lch_tanggal BETWEEN ? AND ?
        GROUP BY d.lcd_jns_mesin, m.msn_kapasitas
        ORDER BY Total_Meter DESC
    `;

    const sqlHarian = `
        SELECT 
            DATE_FORMAT(h.lch_tanggal, '%Y-%m-%d') AS Tanggal,
            d.lcd_jns_mesin AS Mesin,
            ROUND(SUM(d.lcd_qty_Cetak * IFNULL(s.spk_panjang, 0) * IFNULL(s.spk_lebar, 0)), 1) AS Total_Meter
        FROM tlhk_cetakmmt_hdr h
        INNER JOIN tlhk_cetakmmt_dtl d ON h.lch_nomor = d.lcd_lch_nomor
        LEFT JOIN tspk s ON s.spk_nomor = d.lcd_spk_nomor
        WHERE h.lch_tanggal BETWEEN ? AND ?
        GROUP BY h.lch_tanggal, d.lcd_jns_mesin
        ORDER BY h.lch_tanggal ASC, d.lcd_jns_mesin ASC
    `;

    const [rekapMesin] = await pool.query(sqlMesin, [tglMulai, tglSelesai]);
    const [rekapHarian] = await pool.query(sqlHarian, [tglMulai, tglSelesai]);

    return { 
        rekapMesin, 
        rekapHarian 
    };
};

/**
 * Export Excel CrossTab (Mesin vs Tanggal)
 */
const getExportLhkCrossTab = async (month, year) => {
    const sql = `
        SELECT 
            h.lmesin AS Mesin,
            DAY(h.ltanggal) AS Hari,
            SUM(d.ld_luas_m2) AS Total_Meter
        FROM tlhk_mesin_dtl d
        JOIN tlhk_mesin_hdr h ON d.ld_lnomor = h.lnomor
        WHERE MONTH(h.ltanggal) = ? AND YEAR(h.ltanggal) = ?
        GROUP BY h.lmesin, DAY(h.ltanggal)
    `;

    const [rows] = await pool.query(sql, [month, year]);
    return rows;
};

/**
 * Export data detail lengkap ke Excel/CSV
 */
const getAllDataForExport = async (startDate, endDate, mesin) => {
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    let params = [tglMulai, tglSelesai];
    let filterMesin = "";

    if (mesin) {
        const mesinArray = Array.isArray(mesin) ? mesin : mesin.split(',').filter(m => m.trim() !== '');
        if (mesinArray.length > 0) {
            filterMesin = ` AND h.lmesin IN (${mesinArray.map(() => '?').join(',')})`;
            params.push(...mesinArray);
        }
    }

const sql = `
    SELECT 
        h.lnomor AS Nomor_LHK, -- Tetap Nomor_LHK agar sesuai grouping frontend
        DATE_FORMAT(h.ltanggal, '%d/%m/%Y') AS Tanggal,
        h.lshift AS Shift_LHK,
        h.loperator AS Operator_LHK,
        g.gdg_nama AS Gudang,
        d.ld_spk_nomor AS Nomor_SPK,
        s.spk_nama AS Nama_Order, -- Alias ini harus sama dengan LHK Cetak
        h.lmesin AS Mesin,
        d.ld_total_qtycetak AS Qty_Cetak,
        IFNULL(s.spk_panjang, 0) AS Panjang,
        IFNULL(s.spk_lebar, 0) AS Lebar,
        d.ld_luas_m2 AS m2_cetak -- Alias ini penting untuk perhitungan total per baris
    FROM tlhk_mesin_hdr h
    JOIN tlhk_mesin_dtl d ON h.lnomor = d.ld_lnomor
    LEFT JOIN tGUDANG g ON g.gdg_kode = h.lgdg_prod
    LEFT JOIN tspk s ON s.spk_nomor = d.ld_spk_nomor
    WHERE h.ltanggal BETWEEN ? AND ?
    ${filterMesin}
    ORDER BY h.ltanggal DESC, h.lnomor DESC, d.ld_urut ASC
`;

    const [rows] = await pool.query(sql, params);
    return rows;
};

/**
 * Mendapatkan detail pengerjaan SPK per mesin tertentu
 */
const getDetailRekapMesin = async (startDate, endDate, mesin) => {
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    const sql = `
        SELECT 
            d.ld_spk_nomor AS No_SPK,
            s.spk_nama AS Nama_Order,
            SUM(d.ld_total_qtycetak) AS Total_Pcs,
            SUM(d.ld_luas_m2) AS Total_Meter
        FROM tlhk_mesin_dtl d
        JOIN tlhk_mesin_hdr h ON d.ld_lnomor = h.lnomor
        LEFT JOIN tspk s ON s.spk_nomor = d.ld_spk_nomor
        WHERE h.ltanggal BETWEEN ? AND ?
          AND h.lmesin = ?
        GROUP BY d.ld_spk_nomor, s.spk_nama
        ORDER BY Total_Meter DESC
    `;

    const [rows] = await pool.query(sql, [tglMulai, tglSelesai, mesin]);
    return rows;
};


/**
 * Mengambil data LHK Cetak secara mendalam berdasarkan nomor
 * Digunakan untuk Form Edit atau Detail View
 */
const getDetailsByNomor = async (nomor) => {
    try {
        // 1. Ambil Data Header
        const sqlHeader = `
            SELECT 
                t1.lnomor AS Nomor, 
                t1.lshift AS Shift, 
                DATE_FORMAT(t1.ltanggal, '%Y-%m-%d') AS Tanggal,
                t1.lmesin AS Mesin, 
                t1.lgdg_prod AS Gudang,
                t1.loperator AS Operator,
                t1.lbahan AS Kode_bahan,
                t3.brg_nama AS Nama_bahan,
                t1.lbarcode_roll AS Barcode,
                t1.lstatus AS Status,
                t1.ljumlah_kolom AS Tile_Header,
                IFNULL(t1.lpanjang_bs, 0) AS PanjangBS,
                IFNULL(t1.llebar_bs, 0) AS LebarBS,
                IFNULL(t1.lpanjang_afal, 0) AS PanjangAfal,
                IFNULL(t1.llebar_afal, 0) AS LebarAfal
            FROM tlhk_mesin_hdr t1
            LEFT JOIN tbarang_mmt t3 ON t3.brg_kode = t1.lbahan
            WHERE t1.lnomor = ?
        `;
        const [headerRows] = await pool.query(sqlHeader, [nomor]);

        if (headerRows.length === 0) {
            throw new Error(`Data LHK dengan nomor ${nomor} tidak ditemukan`);
        }

        // 2. Ambil Data Detail beserta info SPK, akumulasi, DAN data cetak 1-7
        const sqlDetail = `
            SELECT 
                d.ld_urut AS urut,
                d.ld_spk_nomor AS nomor_spk,
                s.spk_nama AS nama_spk,
                IFNULL(s.spk_jumlah, 0) AS qty_order,
                
                -- Field Cetak yang disesuaikan dengan saveLhk
                IFNULL(d.ld_qtyCetak1, 0) AS cetak1,
                IFNULL(d.ld_qtyCetak2, 0) AS cetak2,
                IFNULL(d.ld_qtyCetak3, 0) AS cetak3,
                IFNULL(d.ld_qtyCetak4, 0) AS cetak4,
                IFNULL(d.ld_qtyCetak5, 0) AS cetak5,
                IFNULL(d.ld_qtyCetak6, 0) AS cetak6,
                IFNULL(d.ld_qtyCetak7, 0) AS cetak7,

                -- Field Ambil Bahan & Sisa Bahan untuk kebutuhan edit/view
                IFNULL(d.ld_ambilbahan, 0) AS ambilBahanPanjang,
                IFNULL(d.ld_ambilbahan_lebar, 0) AS ambilBahanLebar,
                IFNULL(d.ld_sisameter, 0) AS sisabahan,
                IFNULL(d.ld_sisalebar, 0) AS sisabahanlebar,
                IFNULL(d.ld_luas_m2, 0) AS luasm2,
                IFNULL(d.ld_padding, 0) AS padding,

                -- Akumulasi sebelum LHK ini
                IFNULL((SELECT SUM(dx.ld_total_qtycetak) 
                  FROM tlhk_mesin_dtl dx 
                  WHERE dx.ld_spk_nomor = d.ld_spk_nomor 
                  AND dx.ld_lnomor < d.ld_lnomor), 0) AS sudah_cetak_sebelumnya,
                  
                d.ld_total_qtycetak AS totalcetak,
                
                -- RUMUS KURANG CETAK (SISA)
                CAST(GREATEST(0, IFNULL(s.spk_jumlah, 0) - (
                    IFNULL((SELECT SUM(dx.ld_total_qtycetak) 
                            FROM tlhk_mesin_dtl dx 
                            WHERE dx.ld_spk_nomor = d.ld_spk_nomor 
                            AND dx.ld_lnomor < d.ld_lnomor), 0) + d.ld_total_qtycetak
                )) AS UNSIGNED) AS kurang_cetak,
                
                d.ld_total_metercetak AS cetakmeter,
                d.ld_tile AS tile
            FROM tlhk_mesin_dtl d
            LEFT JOIN tspk s ON s.spk_nomor = d.ld_spk_nomor
            WHERE d.ld_lnomor = ?
            ORDER BY d.ld_urut ASC
        `;
        const [detailRows] = await pool.query(sqlDetail, [nomor]);
        
        return {
            header: headerRows[0],
            details: detailRows
        };

    } catch (error) {
        console.error("Error getLhkByNomor:", error);
        throw new Error(`Gagal mengambil detail LHK: ${error.message}`);
    }
};

module.exports = {
    getAllHeaders,
    getLookup,
    getLookupByNomor,
    generateNewNomor,
    getLookupByMultipleNomor,
    deleteLhk,
    saveLhk,
    getLaporanAgregasi,
    getRekapLhk,
    getExportLhkCrossTab,
    getAllDataForExport,
    getDetailRekapMesin,
    getDetailsByNomor

};