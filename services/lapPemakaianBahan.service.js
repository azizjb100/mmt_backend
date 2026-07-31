const pool = require("../config/db.config");
const { format } = require("date-fns");

const getFullProductionReport = async (startDate, endDate, mesin) => {
  try {
    const tglMulai = format(new Date(startDate), "yyyy-MM-dd");
    const tglSelesai = format(new Date(endDate), "yyyy-MM-dd");

    let params = [tglMulai, tglSelesai];
    let filterMesin = "";

    if (mesin) {
      const mesinArray = Array.isArray(mesin)
        ? mesin
        : mesin.split(",").filter((m) => m.trim() !== "");
      if (mesinArray.length > 0) {
        filterMesin = ` AND d.lcd_jns_mesin IN (${mesinArray.map(() => "?").join(",")})`;
        params.push(...mesinArray);
      }
    }

    // 1. Query Detail SPK & Pemakaian Bahan
    const sql = `
            SELECT 
                DATE_FORMAT(h.lch_tanggal, '%Y-%m-%d') AS tgl,
                IFNULL(h.lch_shift, 1) AS shift,
                h.lch_nomor AS no_lhk_cetak,
                IFNULL(d.lcd_lnomor, '') AS lnomor,
                
                IFNULL(d.lcd_spk_nomor, '') AS noSpk,
                MAX(IFNULL(s.spk_nama, '')) AS namaOrder,
                
                MAX(IFNULL(d.lcd_toleransi, 0)) AS s12,
                MAX(IFNULL(d.lcd_toleransi2, 0)) AS s34,
                MAX(ROUND(IFNULL(s.spk_panjang, 0), 2)) AS p,
                MAX(ROUND(IFNULL(s.spk_lebar, 0), 2)) AS l,
                MAX(IFNULL(s.spk_gramasi, '')) AS gsm,
                
                MAX(IFNULL(d.lcd_qty_cetak, 0)) AS orderPcs,
                MAX(IFNULL(s.spk_panjang_roll, 0)) AS pRoll,
                MAX(ROUND(IFNULL(d.lcd_ambil_bahan_l, 0), 2)) AS lebarBahan,
                
                IFNULL(d.lcd_qty_cetak, 0) AS hasilQty,
                MAX(IFNULL(s.spk_panjang_roll, 0)) AS hasilPRoll,
                
                MAX(ROUND(IFNULL(md.ld_ambilbahan, 0), 2)) AS ambilP,
                MAX(ROUND(IFNULL(md.ld_ambilbahan_lebar, 0), 2)) AS ambilL,
                
                MAX(ROUND(IFNULL(md.ld_sisameter, 0), 2)) AS sisaBisaPakaiP,
                MAX(ROUND(IFNULL(md.ld_sisalebar, 0), 2)) AS sisaBisaPakaiL,
                
                MAX(ROUND(IFNULL(md.ld_panjang_afal, 0), 2)) AS sisaRongsokP,
                MAX(ROUND(IFNULL(md.ld_lebar_afal, 0), 2)) AS sisaRongsokL,
                MAX(ROUND(IFNULL(d.lcd_waste, 0), 2)) AS wasteMeter,
                
                MAX(IFNULL(mh.lmesin, '')) AS kodeMesin,
                MAX(IFNULL(mh.lbarcode_roll, '')) AS barcodeRoll

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
            
            GROUP BY h.lch_tanggal, h.lch_shift, h.lch_nomor, d.lcd_lnomor, d.lcd_spk_nomor, d.lcd_qty_cetak
            ORDER BY h.lch_tanggal ASC, h.lch_shift ASC, h.lch_nomor ASC
        `;

    // 2. Query Tinta per Shift (dibulatkan 2 desimal)
    const sqlInk = `
            SELECT 
                DATE_FORMAT(h.lch_tanggal, '%Y-%m-%d') AS tgl,
                IFNULL(h.lch_shift, 1) AS shift,
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
            JOIN tlhk_cetakmmt_ink i ON h.lch_nomor = i.lci_lch_nomor
            WHERE h.lch_tanggal BETWEEN ? AND ?
            GROUP BY h.lch_tanggal, h.lch_shift
        `;

    const [rows] = await pool.query(sql, params);
    const [inkRows] = await pool.query(sqlInk, [tglMulai, tglSelesai]);

    const inkMap = {};
    if (Array.isArray(inkRows)) {
      inkRows.forEach((ink) => {
        if (ink && ink.tgl) {
          inkMap[`${ink.tgl}_${ink.shift}`] = ink;
        }
      });
    }

    const groupedByShift = {};
    if (Array.isArray(rows)) {
      rows.forEach((row) => {
        if (row && row.tgl) {
          const shiftKey = `${row.tgl}_Shift${row.shift}`;
          if (!groupedByShift[shiftKey]) groupedByShift[shiftKey] = [];
          groupedByShift[shiftKey].push(row);
        }
      });
    }

    const finalReport = [];
    let lastTgl = "";

    Object.keys(groupedByShift).forEach((shiftKey) => {
      const shiftRows = groupedByShift[shiftKey];
      if (!shiftRows || shiftRows.length === 0) return;

      const firstRowShift = shiftRows[0];
      const tintaShift =
        inkMap[`${firstRowShift.tgl}_${firstRowShift.shift}`] || {};

      const groupedLO = {};
      shiftRows.forEach((row) => {
        const loKey = `${row.no_lhk_cetak}_${row.lnomor || row.noSpk}`;
        if (!groupedLO[loKey]) groupedLO[loKey] = [];
        groupedLO[loKey].push(row);
      });

      let isFirstRowOfShift = true;

      Object.keys(groupedLO).forEach((loKey) => {
        const group = groupedLO[loKey];
        const isGabungan = group.length > 1;

        let sumOrderLuas = 0;
        let sumHasilLuas = 0;
        let sumP = 0;
        let sumL = 0;
        let sumOrderPcs = 0;
        let sumHasilQty = 0;
        const spkSet = new Set();

        const processedRows = group.map((row) => {
          const p = parseFloat(parseFloat(row.p || 0).toFixed(2));
          const l = parseFloat(parseFloat(row.l || 0).toFixed(2));
          const s12 = parseFloat(parseFloat(row.s12 || 0).toFixed(2));
          const s34 = parseFloat(parseFloat(row.s34 || 0).toFixed(2));
          const orderPcs = parseFloat(row.orderPcs) || 0;
          const hasilQty = parseFloat(row.hasilQty) || 0;

          // Rumus Toleransi & Order
          const persenToleransi =
            p === 0 ? 0 : ((p + s12) * (l + s34) - p * l) / (p * l);
          const orderLuas = p * l * orderPcs;
          const toleransiM2 = orderLuas * persenToleransi;
          const toleransiPersen = orderLuas === 0 ? 0 : toleransiM2 / orderLuas;
          const hasilLuas = p * l * hasilQty;

          // Akumulasi untuk LO Summary
          sumP += p;
          sumL += l;
          sumOrderPcs += orderPcs;
          sumHasilQty += hasilQty;
          sumOrderLuas += orderLuas;
          sumHasilLuas += hasilLuas;
          if (row.noSpk) spkSet.add(row.noSpk);

          // Nilai Ambil Bahan & Sisa (Dibulatkan 2 Desimal terlebih dahulu)
          const ambilP = isGabungan
            ? 0
            : parseFloat((parseFloat(row.ambilP) || 0).toFixed(2));
          const ambilL = isGabungan
            ? 0
            : parseFloat((parseFloat(row.ambilL) || 0).toFixed(2));
          const sisaBisaPakaiP = isGabungan
            ? 0
            : parseFloat((parseFloat(row.sisaBisaPakaiP) || 0).toFixed(2));
          const sisaBisaPakaiL = isGabungan
            ? 0
            : parseFloat((parseFloat(row.sisaBisaPakaiL) || 0).toFixed(2));
          const sisaRongsokP = isGabungan
            ? 0
            : parseFloat((parseFloat(row.sisaRongsokP) || 0).toFixed(2));
          const sisaRongsokL = isGabungan
            ? 0
            : parseFloat((parseFloat(row.sisaRongsokL) || 0).toFixed(2));

          const ambilLuas = ambilP * ambilL;
          const sisaBisaPakaiLuas = sisaBisaPakaiP * sisaBisaPakaiL;
          const sisaRongsokLuas = isGabungan
            ? 0
            : parseFloat((parseFloat(row.wasteMeter) || 0).toFixed(2));
          const aktualLuasPakai = isGabungan
            ? 0
            : ambilLuas - sisaBisaPakaiLuas - sisaRongsokLuas;

          // Kalkulasi Waste & Lost untuk SPK Biasa
          let wasteM2 = 0;
          let wastePersen = 0;
          let lostM2 = 0;
          let lostPersen = 0;
          let totalWasteM2 = 0;
          let totalWastePersen = 0;

          if (!isGabungan) {
            wasteM2 = sisaRongsokLuas;
            wastePersen = orderLuas > 0 ? (wasteM2 / orderLuas) * 100 : 0;
            lostM2 = aktualLuasPakai - orderLuas - toleransiM2;
            lostPersen = orderLuas > 0 ? (lostM2 / orderLuas) * 100 : 0;
            totalWasteM2 = wasteM2 + lostM2;
            totalWastePersen =
              orderLuas > 0 ? (totalWasteM2 / orderLuas) * 100 : 0;
          }

          const showTgl = row.tgl !== lastTgl;
          if (showTgl) lastTgl = row.tgl;

          const showShift = isFirstRowOfShift;
          const showInk = isFirstRowOfShift && !isGabungan;
          if (showInk) isFirstRowOfShift = false;

          return {
            ...row,
            isLO: false,
            isGabunganChild: isGabungan,
            showTgl: showTgl,
            showShift: showShift,
            persenToleransi: parseFloat((persenToleransi * 100).toFixed(2)),
            toleransiM2: parseFloat(toleransiM2.toFixed(2)),
            toleransiPersen: parseFloat((toleransiPersen * 100).toFixed(2)),

            orderPcs: isGabungan ? 0 : orderPcs,
            orderLuas: isGabungan ? 0 : parseFloat(orderLuas.toFixed(2)),

            hasilQty: hasilQty,
            hasilPRoll: parseFloat((row.hasilPRoll || 0).toFixed(2)),
            hasilLuas: parseFloat(hasilLuas.toFixed(2)),

            ambilP: parseFloat(ambilP.toFixed(2)),
            ambilL: parseFloat(ambilL.toFixed(2)),
            ambilLuas: parseFloat(ambilLuas.toFixed(2)),

            sisaBisaPakaiP: parseFloat(sisaBisaPakaiP.toFixed(2)),
            sisaBisaPakaiL: parseFloat(sisaBisaPakaiL.toFixed(2)),
            sisaBisaPakaiLuas: parseFloat(sisaBisaPakaiLuas.toFixed(2)),

            sisaRongsokP: parseFloat(sisaRongsokP.toFixed(2)),
            sisaRongsokL: parseFloat(sisaRongsokL.toFixed(2)),
            sisaRongsokLuas: parseFloat(sisaRongsokLuas.toFixed(2)),

            aktualLuasPakai: parseFloat(aktualLuasPakai.toFixed(2)),

            wasteM2: parseFloat(wasteM2.toFixed(2)),
            wastePersen: parseFloat(wastePersen.toFixed(2)),
            lostM2: parseFloat(lostM2.toFixed(2)),
            lostPersen: parseFloat(lostPersen.toFixed(2)),
            totalWasteM2: parseFloat(totalWasteM2.toFixed(2)),
            totalWastePersen: parseFloat(totalWastePersen.toFixed(2)),

            inkC_MT02: showInk ? tintaShift.inkC_MT02 : null,
            inkM_MT02: showInk ? tintaShift.inkM_MT02 : null,
            inkY_MT02: showInk ? tintaShift.inkY_MT02 : null,
            inkK_MT02: showInk ? tintaShift.inkK_MT02 : null,
            inkC_MT03: showInk ? tintaShift.inkC_MT03 : null,
            inkM_MT03: showInk ? tintaShift.inkM_MT03 : null,
            inkY_MT03: showInk ? tintaShift.inkY_MT03 : null,
            inkK_MT03: showInk ? tintaShift.inkK_MT03 : null,
            inkC_MT04: showInk ? tintaShift.inkC_MT04 : null,
            inkM_MT04: showInk ? tintaShift.inkM_MT04 : null,
            inkY_MT04: showInk ? tintaShift.inkY_MT04 : null,
            inkK_MT04: showInk ? tintaShift.inkK_MT04 : null,
            inkC_MT05: showInk ? tintaShift.inkC_MT05 : null,
            inkM_MT05: showInk ? tintaShift.inkM_MT05 : null,
            inkY_MT05: showInk ? tintaShift.inkY_MT05 : null,
            inkK_MT05: showInk ? tintaShift.inkK_MT05 : null,
          };
        });

        finalReport.push(...processedRows);

        // Tambahkan Ringkasan LO (jika SPK Gabungan)
        if (isGabungan) {
          const first = group[0];
          const ambilP = parseFloat((parseFloat(first.ambilP) || 0).toFixed(2));
          const ambilL = parseFloat((parseFloat(first.ambilL) || 0).toFixed(2));
          const sisaBisaPakaiP = parseFloat(
            (parseFloat(first.sisaBisaPakaiP) || 0).toFixed(2),
          );
          const sisaBisaPakaiL = parseFloat(
            (parseFloat(first.sisaBisaPakaiL) || 0).toFixed(2),
          );
          const sisaRongsokLuas = parseFloat(
            (parseFloat(first.wasteMeter) || 0).toFixed(2),
          );

          const ambilLuas = ambilP * ambilL;
          const sisaBisaPakaiLuas = sisaBisaPakaiP * sisaBisaPakaiL;
          const aktualLuasPakai =
            ambilLuas - sisaBisaPakaiLuas - sisaRongsokLuas;

          const toleransiM2 = sumOrderLuas * 0.02;
          const wasteM2 = sisaRongsokLuas;
          const lostM2 = aktualLuasPakai - sumOrderLuas - toleransiM2;
          const totalWasteM2 = wasteM2 + lostM2;

          const showInk = isFirstRowOfShift;
          if (showInk) isFirstRowOfShift = false;

          finalReport.push({
            tgl: first.tgl,
            shift: first.shift,
            showTgl: false,
            showShift: false,
            isLO: true,
            namaOrder: `LO (${Array.from(spkSet).join(",,")})`,
            noSpk: "",
            s12: parseFloat((parseFloat(first.s12) || 0.06).toFixed(2)),
            s34: parseFloat((parseFloat(first.s34) || 0.06).toFixed(2)),
            persenToleransi: 2.0,
            toleransiM2: parseFloat(toleransiM2.toFixed(2)),
            toleransiPersen: 2.0,
            p: parseFloat(sumP.toFixed(2)),
            l: parseFloat(sumL.toFixed(2)),
            gsm: first.gsm,
            lebarBahan: first.lebarBahan,
            pRoll: first.pRoll,

            orderPcs: sumOrderPcs,
            orderLuas: parseFloat(sumOrderLuas.toFixed(2)),

            hasilPRoll: 0,
            hasilQty: 0,
            hasilLuas: 0,

            ambilP: ambilP,
            ambilL: ambilL,
            ambilLuas: parseFloat(ambilLuas.toFixed(2)),
            sisaBisaPakaiP: sisaBisaPakaiP,
            sisaBisaPakaiL: sisaBisaPakaiL,
            sisaBisaPakaiLuas: parseFloat(sisaBisaPakaiLuas.toFixed(2)),
            sisaRongsokP: parseFloat(
              (parseFloat(first.sisaRongsokP) || 0).toFixed(2),
            ),
            sisaRongsokL: parseFloat(
              (parseFloat(first.sisaRongsokL) || 0).toFixed(2),
            ),
            sisaRongsokLuas: parseFloat(sisaRongsokLuas.toFixed(2)),
            aktualLuasPakai: parseFloat(aktualLuasPakai.toFixed(2)),
            wasteM2: parseFloat(wasteM2.toFixed(2)),
            wastePersen:
              sumOrderLuas === 0
                ? 0
                : parseFloat(((wasteM2 / sumOrderLuas) * 100).toFixed(2)),
            lostM2: parseFloat(lostM2.toFixed(2)),
            lostPersen:
              sumOrderLuas === 0
                ? 0
                : parseFloat(((lostM2 / sumOrderLuas) * 100).toFixed(2)),
            totalWasteM2: parseFloat(totalWasteM2.toFixed(2)),
            totalWastePersen:
              sumOrderLuas === 0
                ? 0
                : parseFloat(((totalWasteM2 / sumOrderLuas) * 100).toFixed(2)),

            kodeMesin: first.kodeMesin,
            barcodeRoll: first.barcodeRoll,

            inkC_MT02: showInk ? tintaShift.inkC_MT02 : null,
            inkM_MT02: showInk ? tintaShift.inkM_MT02 : null,
            inkY_MT02: showInk ? tintaShift.inkY_MT02 : null,
            inkK_MT02: showInk ? tintaShift.inkK_MT02 : null,
            inkC_MT03: showInk ? tintaShift.inkC_MT03 : null,
            inkM_MT03: showInk ? tintaShift.inkM_MT03 : null,
            inkY_MT03: showInk ? tintaShift.inkY_MT03 : null,
            inkK_MT03: showInk ? tintaShift.inkK_MT03 : null,
            inkC_MT04: showInk ? tintaShift.inkC_MT04 : null,
            inkM_MT04: showInk ? tintaShift.inkM_MT04 : null,
            inkY_MT04: showInk ? tintaShift.inkY_MT04 : null,
            inkK_MT04: showInk ? tintaShift.inkK_MT04 : null,
            inkC_MT05: showInk ? tintaShift.inkC_MT05 : null,
            inkM_MT05: showInk ? tintaShift.inkM_MT05 : null,
            inkY_MT05: showInk ? tintaShift.inkY_MT05 : null,
            inkK_MT05: showInk ? tintaShift.inkK_MT05 : null,
          });
        }
      });
    });

    return finalReport;
  } catch (error) {
    console.error("Error getFullProductionReport:", error);
    return [];
  }
};

module.exports = { getFullProductionReport };
