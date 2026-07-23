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
            filterMesin = ` AND d.lcd_jns_mesin IN (${mesinArray.map(() => '?').join(',')})`;
            params.push(...mesinArray);
        }
    }

    const sql = `
        SELECT 
            -- A & B: TGL & SHIFT
            DATE_FORMAT(h.lch_tanggal, '%Y-%m-%d') AS tgl,
            h.lch_shift AS shift,
            h.lch_nomor AS no_lhk_cetak,
            
            -- C & D: TOLERANSI S1,2 & S3,4 (M)
            MAX(IFNULL(d.lcd_toleransi, 0)) AS s12,
            MAX(IFNULL(d.lcd_toleransi2, 0)) AS s34,
            
            -- H & I: SPK INFO
            MAX(s.spk_nama) AS namaOrder,
            d.lcd_spk_nomor AS noSpk,
            
            -- J, K, L, M, N: UKURAN & JENIS BAHAN
            MAX(ROUND(IFNULL(s.spk_panjang, 0), 2)) AS p,
            MAX(ROUND(IFNULL(s.spk_lebar, 0), 2)) AS l,
            MAX(IFNULL(s.spk_gramasi, '')) AS gsm,
            MAX(ROUND(IFNULL(d.lcd_ambil_bahan_l, 0), 2)) AS lebarBahan,
            MAX(IFNULL(s.spk_panjang_roll, 0)) AS pRoll,
            
            -- O: ORDER SPK PCS
            MAX(IFNULL(d.lcd_qty_cetak, 0)) AS orderPcs,
            
            -- Q & R: HASIL CETAK
            MAX(IFNULL(d.lcd_qty_cetak, 0)) AS hasilPRoll,
            d.lcd_qty_cetak AS hasilQty,
            
            -- T, U: AMBIL BAHAN (PANJANG & LEBAR)
            MAX(ROUND(IFNULL(md.ld_ambilbahan, 0), 2)) AS ambilP,
            MAX(ROUND(IFNULL(md.ld_ambilbahan_lebar, 0), 2)) AS ambilL,
            
            -- W, X: KEMBALIAN BAHAN BISA PAKAI (PANJANG & LEBAR)
            MAX(ROUND(IFNULL(md.ld_sisameter, 0), 2)) AS sisaBisaPakaiP,
            MAX(ROUND(IFNULL(md.ld_sisalebar, 0), 2)) AS sisaBisaPakaiL,
            
            -- Z, AA: KEMBALIAN BAHAN TIDAK BISA PAKAI (WASTE METER)
            MAX(ROUND(IFNULL(md.ld_panjang_afal, 0), 2)) AS sisaRongsokP,
            MAX(ROUND(IFNULL(md.ld_lebar_afal, 0), 2)) AS sisaRongsokL,
            MAX(ROUND(IFNULL(d.lcd_waste, 0), 2)) AS wasteMeter,
            
            -- BARCODE & MESIN
            MAX(mh.lmesin) AS kodeMesin,
            MAX(mh.lbarcode_roll) AS barcodeRoll,

            -- TINTA PER MESIN (MT02 - MT05)
            MAX(CASE WHEN i.lci_msn_kode = 'MT02' THEN ROUND(i.lci_c, 2) ELSE 0 END) AS inkC_MT02,
            MAX(CASE WHEN i.lci_msn_kode = 'MT02' THEN ROUND(i.lci_m, 2) ELSE 0 END) AS inkM_MT02,
            MAX(CASE WHEN i.lci_msn_kode = 'MT02' THEN ROUND(i.lci_y, 2) ELSE 0 END) AS inkY_MT02,
            MAX(CASE WHEN i.lci_msn_kode = 'MT02' THEN ROUND(i.lci_k, 2) ELSE 0 END) AS inkK_MT02,
            
            MAX(CASE WHEN i.lci_msn_kode = 'MT03' THEN ROUND(i.lci_c, 2) ELSE 0 END) AS inkC_MT03,
            MAX(CASE WHEN i.lci_msn_kode = 'MT03' THEN ROUND(i.lci_m, 2) ELSE 0 END) AS inkM_MT03,
            MAX(CASE WHEN i.lci_msn_kode = 'MT03' THEN ROUND(i.lci_y, 2) ELSE 0 END) AS inkY_MT03,
            MAX(CASE WHEN i.lci_msn_kode = 'MT03' THEN ROUND(i.lci_k, 2) ELSE 0 END) AS inkK_MT03,

            MAX(CASE WHEN i.lci_msn_kode = 'MT04' THEN ROUND(i.lci_c, 2) ELSE 0 END) AS inkC_MT04,
            MAX(CASE WHEN i.lci_msn_kode = 'MT04' THEN ROUND(i.lci_m, 2) ELSE 0 END) AS inkM_MT04,
            MAX(CASE WHEN i.lci_msn_kode = 'MT04' THEN ROUND(i.lci_y, 2) ELSE 0 END) AS inkY_MT04,
            MAX(CASE WHEN i.lci_msn_kode = 'MT04' THEN ROUND(i.lci_k, 2) ELSE 0 END) AS inkK_MT04,

            MAX(CASE WHEN i.lci_msn_kode = 'MT05' THEN ROUND(i.lci_c, 2) ELSE 0 END) AS inkC_MT05,
            MAX(CASE WHEN i.lci_msn_kode = 'MT05' THEN ROUND(i.lci_m, 2) ELSE 0 END) AS inkM_MT05,
            MAX(CASE WHEN i.lci_msn_kode = 'MT05' THEN ROUND(i.lci_y, 2) ELSE 0 END) AS inkY_MT05,
            MAX(CASE WHEN i.lci_msn_kode = 'MT05' THEN ROUND(i.lci_k, 2) ELSE 0 END) AS inkK_MT05

        FROM tlhk_cetakmmt_hdr h
        JOIN tlhk_cetakmmt_dtl d ON h.lch_nomor = d.lcd_lch_nomor
        LEFT JOIN (
            SELECT spk_nomor, spk_nama, spk_jumlah, spk_panjang, spk_lebar, spk_gramasi, 0 AS spk_panjang_roll FROM tspk
            UNION ALL
            SELECT mspk_nomor, mspk_nama, mspk_jumlah, mspk_panjang, mspk_lebar, '' AS spk_gramasi, 0 AS spk_panjang_roll FROM tmemospk
        ) s ON d.lcd_spk_nomor = s.spk_nomor
        
        LEFT JOIN tlhk_mesin_hdr mh ON d.lcd_lnomor = mh.lnomor
        LEFT JOIN tlhk_mesin_dtl md ON mh.lnomor = md.ld_lnomor AND d.lcd_spk_nomor = md.ld_spk_nomor
        LEFT JOIN tlhk_cetakmmt_ink i ON h.lch_nomor = i.lci_lch_nomor
        
        WHERE h.lch_tanggal BETWEEN ? AND ?
        ${filterMesin}
        
        GROUP BY h.lch_nomor, d.lcd_spk_nomor, d.lcd_qty_cetak
        ORDER BY h.lch_tanggal DESC, h.lch_shift ASC, h.lch_nomor ASC
    `;

    const [rows] = await pool.query(sql, params);
    
    // Kalkulasi Sesuai Rumus Excel (Kolom A - AY)
    return rows.map(row => {
        const p = parseFloat(row.p) || 0;
        const l = parseFloat(row.l) || 0;
        const s12 = parseFloat(row.s12) || 0;
        const s34 = parseFloat(row.s34) || 0;
        const orderPcs = parseFloat(row.orderPcs) || 0;
        const hasilQty = parseFloat(row.hasilQty) || 0;
        const ambilP = parseFloat(row.ambilP) || 0;
        const ambilL = parseFloat(row.ambilL) || 0;
        const sisaBisaPakaiP = parseFloat(row.sisaBisaPakaiP) || 0;
        const sisaBisaPakaiL = parseFloat(row.sisaBisaPakaiL) || 0;

        // E: % Toleransi = IF(J5=0;0;((J5+C5)*(K5+D5)-(J5*K5))/(J5*K5))
        const persenToleransi = p === 0 ? 0 : (((p + s12) * (l + s34) - (p * l)) / (p * l));

        // P: Jumlah SPK (Luas) = J5*K5*O5
        const orderLuas = p * l * orderPcs;

        // F: Toleransi (M2) = P5*E5
        const toleransiM2 = orderLuas * persenToleransi;

        // G: Toleransi (%) = IF(F5=0;0;F5/P5)
        const toleransiPersen = orderLuas === 0 ? 0 : (toleransiM2 / orderLuas);

        // S: Hasil cetak (Luas) = J5*K5*R5
        const hasilLuas = p * l * hasilQty;

        // V: Ambil Bahan (Luas) = T5*U5
        const ambilLuas = ambilP * ambilL;

        // Y: Kembalian bahan sisa (Luas) = W5*X5
        const sisaBisaPakaiLuas = sisaBisaPakaiP * sisaBisaPakaiL;

        // AB: Kembalian bahan tidak bisa pakai (Luas) / Waste Meter
        const sisaRongsokLuas = parseFloat(row.wasteMeter) || 0;

        // AC: Aktual luas pakai = V5-Y5-AB5
        const aktualLuasPakai = ambilLuas - sisaBisaPakaiLuas - sisaRongsokLuas;

        // AD: Waste Meter = AB5
        const wasteM2 = sisaRongsokLuas;

        // AE: Waste % = IF(AD5=0;0;AD5/P5)
        const wastePersen = orderLuas === 0 ? 0 : (wasteM2 / orderLuas);

        // AF: Lost Meter = AC5-P5-F5
        const lostM2 = aktualLuasPakai - orderLuas - toleransiM2;

        // AG: Lost % = IF(AF5=0;0;AF5/P5)
        const lostPersen = orderLuas === 0 ? 0 : (lostM2 / orderLuas);

        // AH: Total Waste Meter = AD5+AF5
        const totalWasteM2 = wasteM2 + lostM2;

        // AI: Total Waste % = IF(P5=0;0;AH5/P5)
        const totalWastePersen = orderLuas === 0 ? 0 : (totalWasteM2 / orderLuas);

        return {
            ...row,
            persenToleransi: parseFloat((persenToleransi * 100).toFixed(2)),
            toleransiM2: parseFloat(toleransiM2.toFixed(2)),
            toleransiPersen: parseFloat((toleransiPersen * 100).toFixed(2)),
            orderLuas: parseFloat(orderLuas.toFixed(2)),
            hasilLuas: parseFloat(hasilLuas.toFixed(2)),
            ambilLuas: parseFloat(ambilLuas.toFixed(2)),
            sisaBisaPakaiLuas: parseFloat(sisaBisaPakaiLuas.toFixed(2)),
            sisaRongsokLuas: parseFloat(sisaRongsokLuas.toFixed(2)),
            aktualLuasPakai: parseFloat(aktualLuasPakai.toFixed(2)),
            wasteM2: parseFloat(wasteM2.toFixed(2)),
            wastePersen: parseFloat((wastePersen * 100).toFixed(2)),
            lostM2: parseFloat(lostM2.toFixed(2)),
            lostPersen: parseFloat((lostPersen * 100).toFixed(2)),
            totalWasteM2: parseFloat(totalWasteM2.toFixed(2)),
            totalWastePersen: parseFloat((totalWastePersen * 100).toFixed(2)),
        };
    });
};

module.exports = { getFullProductionReport };