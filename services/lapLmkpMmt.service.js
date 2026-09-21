const pool = require("../config/db.config");

const throwDbError = (message, error) => {
  console.error(message, error.message);
  throw new Error(message + ": " + error.message);
};

exports.getMonitoringData = async (cbJenisIndex, startDate, endDate) => {
  try {
    let conditionExtra = "";
    let joinLhkCetak = "";
    let fieldJmlCetak = "";
    let joinSizeLhk = "";
    let selectMesinFields = `
        0 AS mt01, 0 AS mt02, 0 AS mt03, 0 AS mt04, 0 AS mt05, 0 AS mi,
        0 AS mx01, 0 AS mx02, 0 AS mx03, 0 AS mx04, 0 AS mx05,
        0 AS sb01, 0 AS sb02, 0 AS sb03, 0 AS sb04, 0 AS sb05,
        0 AS rtr
      `;

    // 1. KATEGORI MT & LM (cbJenisIndex = '0')
    if (cbJenisIndex === "0") {
      fieldJmlCetak = "ifnull(ee.jml_cetak_mmt, 0)";
      conditionExtra =
        "AND spk_cab = 'P05' AND spk_divisi IN (5) AND spk_jo_kode IN ('MT', 'LM')";
      selectMesinFields = `
            ROUND(IFNULL(ee.MT01, 0), 0) AS mt01, ROUND(IFNULL(ee.MT02, 0), 0) AS mt02,
            ROUND(IFNULL(ee.MT03, 0), 0) AS mt03, ROUND(IFNULL(ee.MT04, 0), 0) AS mt04,
            ROUND(IFNULL(ee.MT05, 0), 0) AS mt05, ROUND(IFNULL(ee.MI, 0), 0) AS mi,
            0 AS mx01, 0 AS mx02, 0 AS mx03, 0 AS mx04, 0 AS mx05,
            0 AS sb01, 0 AS sb02, 0 AS sb03, 0 AS sb04, 0 AS sb05,
            0 AS rtr
          `;
      joinLhkCetak = `
            LEFT JOIN (
                SELECT lcd_spk_nomor, 
                    SUM(IF(lcd_jns_mesin='MT01',lcd_qty_cetak,0)) MT01,
                    SUM(IF(lcd_jns_mesin='MT02',lcd_qty_cetak,0)) MT02,
                    SUM(IF(lcd_jns_mesin='MT03',lcd_qty_cetak,0)) MT03,
                    SUM(IF(lcd_jns_mesin='MT04',lcd_qty_cetak,0)) MT04,
                    SUM(IF(lcd_jns_mesin='MT05',lcd_qty_cetak,0)) MT05,
                    SUM(IF(lcd_jns_mesin='MI',lcd_qty_cetak,0)) MI,
                    SUM(IFNULL(lcd_qty_cetak,0)) jml_cetak_mmt
                FROM tlhk_cetakmmt_dtl
                GROUP BY 1
            ) ee ON ee.lcd_spk_nomor = spk_nomor`;
    }
    // 2. KATEGORI MX (cbJenisIndex = '1')
    else if (cbJenisIndex === "1") {
      fieldJmlCetak = "ifnull(ff.jml_cetak_tekstil, 0)";
      conditionExtra =
        "AND spk_cab = 'P05' AND spk_divisi IN (5) AND spk_jo_kode='MX'";
      selectMesinFields = `
            0 AS mt01, 0 AS mt02, 0 AS mt03, 0 AS mt04, 0 AS mt05, 0 AS mi,
            ROUND(IFNULL(ff.MX01, 0), 0) AS mx01, ROUND(IFNULL(ff.MX02, 0), 0) AS mx02,
            ROUND(IFNULL(ff.MX03, 0), 0) AS mx03, ROUND(IFNULL(ff.MX04, 0), 0) AS mx04,
            ROUND(IFNULL(ff.MX05, 0), 0) AS mx05,
            0 AS sb01, 0 AS sb02, 0 AS sb03, 0 AS sb04, 0 AS sb05,
            0 AS rtr
          `;
      joinLhkCetak = `
            LEFT JOIN (
                SELECT ltd_spk_nomor, 
                    SUM(IF(ltd_jns_mesin='MX01',ltd_qty_cetak,0)) MX01,
                    SUM(IF(ltd_jns_mesin='MX02',ltd_qty_cetak,0)) MX02,
                    SUM(IF(ltd_jns_mesin='MX03',ltd_qty_cetak,0)) MX03,
                    SUM(IF(ltd_jns_mesin='MX04',ltd_qty_cetak,0)) MX04,
                    SUM(IF(ltd_jns_mesin='MX05',ltd_qty_cetak,0)) MX05,
                    SUM(IFNULL(ltd_qty_cetak,0)) jml_cetak_tekstil
                FROM tlhk_tekstilmmt_dtl
                GROUP BY 1
            ) ff ON ff.ltd_spk_nomor = spk_nomor`;
    }
    // 3. KATEGORI PAPERPRINT (cbJenisIndex = '2')
    else if (cbJenisIndex === "2") {
      fieldJmlCetak = "ifnull(sb.jml_cetak_paperprint, 0)";
      conditionExtra = "AND spk_sublim = 'Y'";
      selectMesinFields = `
        0 AS mt01, 0 AS mt02, 0 AS mt03, 0 AS mt04, 0 AS mt05, 0 AS mi,
        0 AS mx01, 0 AS mx02, 0 AS mx03, 0 AS mx04, 0 AS mx05,
        ROUND(IFNULL(sb.SB01, 0), 0) AS sb01, ROUND(IFNULL(sb.SB02, 0), 0) AS sb02,
        ROUND(IFNULL(sb.SB03, 0), 0) AS sb03, ROUND(IFNULL(sb.SB04, 0), 0) AS sb04,
        ROUND(IFNULL(sb.SB05, 0), 0) AS sb05,
        0 AS rtr
      `;
      joinLhkCetak = `
        LEFT JOIN (
            SELECT lsbd_spk_nomor, 
                SUM(IF(lsbd_lokasi='SB01',lsbd_jumlah,0)) SB01,
                SUM(IF(lsbd_lokasi='SB02',lsbd_jumlah,0)) SB02,
                SUM(IF(lsbd_lokasi='SB03',lsbd_jumlah,0)) SB03,
                SUM(IF(lsbd_lokasi='SB04',lsbd_jumlah,0)) SB04,
                SUM(IF(lsbd_lokasi='SB05',lsbd_jumlah,0)) SB05,
                SUM(IFNULL(lsbd_jumlah,0)) jml_cetak_paperprint
            FROM tlhk_sublim_dtl
            GROUP BY 1
        ) sb ON sb.lsbd_spk_nomor = spk_nomor`;

      // Perbaikan: Ambil juga detail komponen per size untuk akurasi perhitungan
      joinSizeLhk = `
        LEFT JOIN (
            SELECT 
                lsbd_spk_nomor, 
                lsbd_poid_size, 
                lsbd_komponen,
                SUM(IFNULL(lsbd_jumlah, 0)) AS qty_cetak_komponen
            FROM tlhk_sublim_dtl
            WHERE lsbd_poid_size != '-' AND lsbd_poid_size != ''
            GROUP BY lsbd_spk_nomor, lsbd_poid_size, lsbd_komponen
        ) sz_lhk ON sz_lhk.lsbd_spk_nomor = spks_nomor AND sz_lhk.lsbd_poid_size = spks_size
      `;
    }
    // 4. KATEGORI SUBLIM / RTR (cbJenisIndex = '3')
    else if (cbJenisIndex === "3") {
      fieldJmlCetak = "ifnull(rtr.jml_cetak_sublim, 0)";
      conditionExtra = "AND spk_sublim = 'Y'";
      selectMesinFields = `
        0 AS mt01, 0 AS mt02, 0 AS mt03, 0 AS mt04, 0 AS mt05, 0 AS mi,
        0 AS mx01, 0 AS mx02, 0 AS mx03, 0 AS mx04, 0 AS mx05,
        0 AS sb01, 0 AS sb02, 0 AS sb03, 0 AS sb04, 0 AS sb05,
        ROUND(IFNULL(rtr.RTR, 0), 0) AS rtr
      `;
      joinLhkCetak = `
        LEFT JOIN (
            SELECT lrd_spk_nomor, 
                SUM(IF(lrd_lokasi='RTR',lrd_jumlah,0)) RTR,
                SUM(IFNULL(lrd_jumlah,0)) jml_cetak_sublim
            FROM tlhk_rtr_dtl
            GROUP BY 1
        ) rtr ON rtr.lrd_spk_nomor = spk_nomor`;

      joinSizeLhk = `
        LEFT JOIN (
            SELECT 
                lrd_spk_nomor, 
                lrd_poid_size, 
                lrd_komponen,
                SUM(IFNULL(lrd_jumlah, 0)) AS qty_cetak_komponen
            FROM tlhk_rtr_dtl
            WHERE lrd_poid_size != '-' AND lrd_poid_size != ''
            GROUP BY lrd_spk_nomor, lrd_poid_size, lrd_komponen
        ) sz_lhk ON sz_lhk.lrd_spk_nomor = spks_nomor AND sz_lhk.lrd_poid_size = spks_size
      `;
    }
    // Query Utama Monitoring LMKP
    const sql = `
        SELECT 
            spk_nomor AS NOMOR, spk_memo, spk_tanggal, spk_dateline AS deadline, spk_nama,
            spk_statuskerja, spk_workshop, zz.DIVISI, jo_nama,
            IF(spk_jumlah_kirim >= spk_jumlah, 'Closed', 'Open') AS status,
            spk_panjang AS PANJANG, spk_lebar AS LEBAR, spk_kain AS KAIN, spk_gramasi, spk_finishing AS FINISHING,
            spk_jumlah, spk_jumlah_kirim,

            spk_jumlah - spk_jumlah_kirim AS krg_kirim,
            spk_jumlah - IFNULL(gg.jseaming, 0) AS krg_Seaming,
            spk_jumlah - IFNULL(gg.jmataayam, 0) AS krg_mataayam,
            spk_jumlah - IFNULL(gg.jcoly, 0) AS krg_coly,
            
            spk_jumlah - IF(spk_jumlah < ${fieldJmlCetak}, spk_jumlah, ${fieldJmlCetak}) - IFNULL(h.cetak_luarx, 0) AS krg_Cetak,

            (spk_jumlah - spk_jumlah_kirim) * spk_panjang * IF(spk_divisi=5, IFNULL(spk_lebar, 0), 1) AS krg_kirim_meter,
            (spk_jumlah - IF(spk_jumlah < ${fieldJmlCetak}, spk_jumlah, ${fieldJmlCetak}) - IFNULL(h.cetak_luarx, 0)) * spk_panjang * IFNULL(spk_lebar, 0) AS krg_Cetak_meter,
            (spk_jumlah - IFNULL(gg.jcoly, 0)) * spk_panjang * IFNULL(spk_lebar, 0) AS krg_coly_meter,

            ${selectMesinFields},
            IFNULL(h.cetak_luarx, 0) AS cetak_luarx

        FROM tspk
        INNER JOIN tcustomer ON spk_cus_kode = cus_kode
        LEFT JOIN tsales ON sal_kode = spk_sal_kode
        LEFT JOIN tjenisorder ON jo_kode = spk_jo_kode
        LEFT JOIN tdivisi zz ON zz.kode = spk_divisi
        
        LEFT JOIN (
            SELECT poe_spk_nomor poe_Spk, SUM(IFNULL(poe_jumlah, 0)) cetak_luarx 
            FROM tpoexternal_hdr WHERE poe_cab='P05' GROUP BY 1
        ) h ON h.poe_spk = spk_nomor

        ${joinLhkCetak}

        LEFT JOIN (
            SELECT lfd_spk_nomor, 
                   SUM(lfd_j_Seaming) jseaming, 
                   SUM(lfd_j_mataayam) jmataayam, 
                   SUM(lfd_j_coly) jcoly 
            FROM tlhk_finishingmmt_dtl 
            GROUP BY 1
        ) gg ON gg.lfd_spk_nomor = spk_nomor

        WHERE spk_aktif = 'Y' 
          ${conditionExtra}
          AND spk_tanggal >= CONCAT(?, ' 00:00:00') 
          AND spk_tanggal <= CONCAT(?, ' 23:59:59')
        ORDER BY spk_nama
      `;

    const [rows] = await pool.query(sql, [startDate, endDate]);

    // Ambil data size HANYA jika kategori adalah Paperprint ('2') atau Sublim ('3')
    // Ambil data size & komponen HANYA jika kategori Paperprint ('2') atau Sublim ('3')
    let sizes = [];
    let spkKomponenMap = {};
    let lhkSizeMap = {};
    let lhkAllSetMap = {};

    if (["2", "3"].includes(cbJenisIndex)) {
      const tableDtl =
        cbJenisIndex === "2" ? "tlhk_sublim_dtl" : "tlhk_rtr_dtl";
      const prefix = cbJenisIndex === "2" ? "lsbd" : "lrd";

      // Pastikan rows ada isinya sebelum mengambil nomor SPK
      if (rows && rows.length > 0) {
        const spkNomors = rows.map((r) => `'${r.NOMOR}'`).join(",");

        // 1. Ambil daftar komponen wajib dari tspk_komponen_potong dan tspk_komponen HANYA untuk SPK yang tampil
        const kompSql = `
        SELECT p.sk_nomor AS spk_nomor, k.bhn_name AS komponen_nama 
        FROM tspk_komponen_potong p
        INNER JOIN tbahan k ON k.bhn_kode = p.sk_kode
        WHERE p.sk_nomor IN (${spkNomors})
        UNION
        SELECT DISTINCT ${prefix}_spk_nomor AS spk_nomor, ${prefix}_komponen AS komponen_nama
        FROM ${tableDtl}
        WHERE ${prefix}_spk_nomor IN (${spkNomors}) 
          AND ${prefix}_komponen != 'ALL SET' 
          AND ${prefix}_komponen IS NOT NULL
      `;
        const [kompRows] = await pool.query(kompSql);

        kompRows.forEach((k) => {
          if (!spkKomponenMap[k.spk_nomor]) {
            spkKomponenMap[k.spk_nomor] = [];
          }
          if (!spkKomponenMap[k.spk_nomor].includes(k.komponen_nama)) {
            spkKomponenMap[k.spk_nomor].push(k.komponen_nama);
          }
        });

        // 2. Ambil seluruh data LHK untuk SPK yang tampil
        const lhkDetailSql = `
        SELECT 
          ${prefix}_spk_nomor AS spk_nomor,
          ${prefix}_poid_size AS poid_size,
          ${prefix}_komponen AS komponen_nama,
          SUM(IFNULL(${prefix}_jumlah, 0)) AS qty_cetak
        FROM ${tableDtl}
        WHERE ${prefix}_spk_nomor IN (${spkNomors})
        GROUP BY ${prefix}_spk_nomor, ${prefix}_poid_size, ${prefix}_komponen
      `;
        const [lhkRows] = await pool.query(lhkDetailSql);

        lhkRows.forEach((l) => {
          if (!lhkSizeMap[l.spk_nomor]) lhkSizeMap[l.spk_nomor] = {};
          if (l.poid_size === "-" || !l.poid_size) {
            if (l.komponen_nama === "ALL SET") {
              if (!lhkAllSetMap[l.spk_nomor])
                lhkAllSetMap[l.spk_nomor] = { ALL_SET_GLOBAL: 0 };
              lhkAllSetMap[l.spk_nomor]["ALL_SET_GLOBAL"] += Number(
                l.qty_cetak,
              );
            } else {
              if (!lhkAllSetMap[l.spk_nomor]) lhkAllSetMap[l.spk_nomor] = {};
              lhkAllSetMap[l.spk_nomor][l.komponen_nama] =
                (lhkAllSetMap[l.spk_nomor][l.komponen_nama] || 0) +
                Number(l.qty_cetak);
            }
          } else {
            if (!lhkSizeMap[l.spk_nomor][l.poid_size])
              lhkSizeMap[l.spk_nomor][l.poid_size] = {};
            lhkSizeMap[l.spk_nomor][l.poid_size][l.komponen_nama] =
              (lhkSizeMap[l.spk_nomor][l.poid_size][l.komponen_nama] || 0) +
              Number(l.qty_cetak);
          }
        });

        // 3. Ambil data size dari tspk_size
        const sizeSql = `
        SELECT spks_nomor, spks_size, spks_qty 
        FROM tspk_size 
        WHERE spks_nomor IN (${spkNomors})
      `;
        const [sizeRows] = await pool.query(sizeSql);
        sizes = sizeRows;
      }
    }

    // Mapping data size dan komponen secara manual di Javascript
    const sizeMap = {};

    sizes.forEach((s) => {
      const spkNo = s.spks_nomor;
      const sizeName = s.spks_size;
      const sizeQty = Number(s.spks_qty || 0);

      if (!sizeMap[spkNo]) {
        sizeMap[spkNo] = [];
      }

      const standardKomponen = spkKomponenMap[spkNo] || [
        "BADAN DEPAN",
        "BADAN BELAKANG",
        "TANGAN/LENGAN",
      ];

      const lhkForThisSize =
        (lhkSizeMap[spkNo] && lhkSizeMap[spkNo][sizeName]) || {};
      const lhkGlobalAllSet =
        (lhkAllSetMap[spkNo] && lhkAllSetMap[spkNo]["ALL_SET_GLOBAL"]) || 0;

      const components = [];

      standardKomponen.forEach((komp) => {
        let qtyCetakKomponen = Number(lhkForThisSize[komp] || 0);

        if (lhkForThisSize["ALL SET"]) {
          qtyCetakKomponen += Number(lhkForThisSize["ALL SET"]);
        }
        qtyCetakKomponen += lhkGlobalAllSet;

        components.push({
          komponen_nama: komp,
          qty_cetak: qtyCetakKomponen,
          kurang_cetak: Math.max(0, sizeQty - qtyCetakKomponen),
        });
      });

      const minComponentCetak =
        components.length > 0
          ? Math.min(...components.map((c) => c.qty_cetak))
          : 0;
      const sizeKrgCetak = Math.max(0, sizeQty - minComponentCetak);

      sizeMap[spkNo].push({
        size_name: sizeName,
        size_qty: sizeQty,
        size_krg_cetak: sizeKrgCetak,
        components: components,
      });
    });

    const finalRows = rows.map((row) => {
      const sizesForThisSpk = sizeMap[row.NOMOR] || [];

      let finalKrgCetak = row.krg_Cetak; // Ambil bawaan dari SQL

      // Jika kategori Paperprint ('2') atau Sublim ('3'), baru timpa dengan hitungan size
      if (["2", "3"].includes(cbJenisIndex)) {
        finalKrgCetak = sizesForThisSpk.reduce(
          (sum, s) => sum + Number(s.size_krg_cetak || 0),
          0,
        );
      }

      return {
        ...row,
        krg_Cetak: finalKrgCetak,
        sizes: sizesForThisSpk,
      };
    });

    return finalRows;
  } catch (error) {
    throwDbError("Gagal mengambil data LMKP", error);
  }
};

exports.getKapasitasMesin = async (cbJenisIndex) => {
  try {
    let sql = "";
    if (cbJenisIndex === "0") {
      sql =
        "SELECT SUM(msn_kapasitas) output FROM tmesin_mmt WHERE msn_JENIS='C'";
    } else {
      sql =
        "SELECT SUM(msn_kapasitas) output FROM tmesin_mmt WHERE msn_JENIS='T'";
    }

    const [rows] = await pool.query(sql);
    return rows[0]?.output || 0;
  } catch (error) {
    throwDbError("Gagal mengambil kapasitas mesin", error);
  }
};
