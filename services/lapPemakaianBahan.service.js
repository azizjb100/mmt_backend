const pool = require('../config/db.config');
const { format } = require('date-fns');

const getFullProductionReport = async (startDate, endDate, mesin) => {
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    let params = [tglMulai, tglSelesai];
    let filterMesin = "";

    if (mesin) {
        const mesinArray = Array.isArray(mesin) ? mesin : mesin.split(',').filter(m => m.trim() !== '');
        if (mesinArray.length > 0) {
            // Filter mesin biasanya merujuk pada kolom di detail atau header cetak
            filterMesin = ` AND d.lcd_jns_mesin IN (${mesinArray.map(() => '?').join(',')})`;
            params.push(...mesinArray);
        }
    }

    const sql = `
        SELECT 
            -- 1. IDENTITAS (Dari tlhk_cetakmmt_hdr)
            DATE_FORMAT(h.lch_tanggal, '%Y-%m-%d') AS tgl,
            h.lch_shift AS shift,
            h.lch_nomor AS no_lhk_cetak,
            
            -- 2. TOLERANSI & WASTE (Pembulatan 1 Desimal)
            ROUND(IFNULL(d.lcd_toleransi, 0), 1) AS s12,
            ROUND(IFNULL(d.lcd_toleransi2, 0), 1) AS s34,
            ROUND(IFNULL(d.lcd_waste, 0), 1) AS wasteM2,
            ROUND(IFNULL(d.lcd_lost, 0), 1) AS lostM2,
            
            -- 3. DETAIL ORDER SPK
            d.lcd_spk_nomor AS noSpk,
            s.spk_nama AS namaOrder,
            ROUND(IFNULL(s.spk_panjang, 0), 1) AS p,
            ROUND(IFNULL(s.spk_lebar, 0), 1) AS l,
            IFNULL(s.spk_gramasi, '') AS gsm,
            
            -- 4. INFO BAHAN & ORDER
            ROUND(IFNULL(d.lcd_ambil_bahan_l, 0), 1) AS lebarBahan,
            IFNULL(s.spk_panjang_roll, 0) AS pRoll,
            IFNULL(s.spk_jumlah, 0) AS orderPcs,
            -- Kalkulasi Luas Order (P * L * Qty Order)
            ROUND((IFNULL(s.spk_panjang, 0) * IFNULL(s.spk_lebar, 0) * IFNULL(s.spk_jumlah, 0)), 1) AS orderLuas,
            
            -- 5. HASIL CETAK
            d.lcd_qty_cetak AS hasilQty,
            d.lcb_ukurancetak AS gsm_cetak,
            -- Kalkulasi Luas Hasil (P * L * Qty Cetak)
            ROUND((IFNULL(s.spk_panjang, 0) * IFNULL(s.spk_lebar, 0) * d.lcd_qty_cetak), 1) AS hasilLuas,
            
            -- 6. DATA OPERASIONAL MESIN
            ROUND(IFNULL(md.ld_ambilbahan, 0), 1) AS ambilP,
            ROUND(IFNULL(md.ld_ambilbahan_lebar, 0), 1) AS ambilL,
            ROUND(IFNULL(md.ld_total_metercetak, 0), 1) AS ambilLuas,
            mh.lmesin AS kodeMesin,
            mh.lbarcode_roll AS barcodeRoll,
            ROUND(IFNULL(md.ld_sisameter, 0), 1) AS sisaBahanP,
            ROUND(IFNULL(md.ld_sisalebar, 0), 1) AS sisaBahanL,
            
            -- 7. TINTA
            ROUND(IFNULL(h.lch_ink_c, 0), 1) AS inkC, 
            ROUND(IFNULL(h.lch_ink_m, 0), 1) AS inkM, 
            ROUND(IFNULL(h.lch_ink_y, 0), 1) AS inkY, 
            ROUND(IFNULL(h.lch_ink_k, 0), 1) AS inkK
            
        FROM tlhk_cetakmmt_hdr h
        JOIN tlhk_cetakmmt_dtl d ON h.lch_nomor = d.lcd_lch_nomor
        LEFT JOIN (
            SELECT spk_nomor, spk_nama, spk_jumlah, spk_panjang, spk_lebar, spk_gramasi, 0 AS spk_panjang_roll FROM tspk
            UNION ALL
            SELECT mspk_nomor, mspk_nama, mspk_jumlah, mspk_panjang, mspk_lebar, '' AS spk_gramasi, 0 AS spk_panjang_roll FROM tmemospk
        ) s ON d.lcd_spk_nomor = s.spk_nomor
        
        LEFT JOIN tlhk_mesin_hdr mh ON d.lcd_lnomor = mh.lnomor
        LEFT JOIN tlhk_mesin_dtl md ON mh.lnomor = md.ld_lnomor AND d.lcd_spk_nomor = md.ld_spk_nomor
        
        WHERE h.lch_tanggal BETWEEN ? AND ?
        ${filterMesin}
        ORDER BY h.lch_tanggal DESC, h.lch_shift ASC, h.lch_nomor ASC
    `;

    const [rows] = await pool.query(sql, params);
    
    // Mapping kalkulasi persentase di level aplikasi (JavaScript)
    return rows.map(row => {
        const orderLuas = parseFloat(row.orderLuas) || 0;
        const hasilLuas = parseFloat(row.hasilLuas) || 0;
        const ambilLuas = parseFloat(row.ambilLuas) || 0;
        const wasteM2 = parseFloat(row.wasteM2) || 0;
        const lostM2 = parseFloat(row.lostM2) || 0;

        return {
            ...row,
            // (Hasil Luas / Luas Order) * 100
            persenToleransi: orderLuas > 0 ? parseFloat(((hasilLuas / orderLuas) * 100).toFixed(1)) : 0,
            
            // Total Waste (Waste + Lost)
            totalWasteM2: parseFloat((wasteM2 + lostM2).toFixed(1)),
            
            // Persentase Waste terhadap Bahan yang diambil
            wastePersen: ambilLuas > 0 ? parseFloat(((wasteM2 / ambilLuas) * 100).toFixed(1)) : 0,
            lostPersen: ambilLuas > 0 ? parseFloat(((lostM2 / ambilLuas) * 100).toFixed(1)) : 0,
            totalWastePersen: ambilLuas > 0 ? parseFloat((((wasteM2 + lostM2) / ambilLuas) * 100).toFixed(1)) : 0
        };
    });
};

module.exports = { getFullProductionReport };