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

    // Default field struktur mesin
    let selectMesinFields = `
            0 AS mt01, 0 AS mt02, 0 AS mt03, 0 AS mt04, 0 AS mt05, 0 AS mi,
            0 AS mx01, 0 AS mx02, 0 AS mx03, 0 AS mx04, 0 AS mx05,
            0 AS sb01, 0 AS sb02, 0 AS sb03, 0 AS sb04, 0 AS sb05
        `;

    // 1. KATEGORI MT (cbJenisIndex = '0')
    if (cbJenisIndex === "0") {
      fieldJmlCetak = "ifnull(ee.jml_cetak_mmt, 0)";
      conditionExtra = "AND spk_divisi IN (5) AND spk_jo_kode='MT'";
      selectMesinFields = `
                ROUND(IFNULL(ee.MT01, 0), 0) AS mt01, ROUND(IFNULL(ee.MT02, 0), 0) AS mt02,
                ROUND(IFNULL(ee.MT03, 0), 0) AS mt03, ROUND(IFNULL(ee.MT04, 0), 0) AS mt04,
                ROUND(IFNULL(ee.MT05, 0), 0) AS mt05, ROUND(IFNULL(ee.MI, 0), 0) AS mi,
                0 AS mx01, 0 AS mx02, 0 AS mx03, 0 AS mx04, 0 AS mx05,
                0 AS sb01, 0 AS sb02, 0 AS sb03, 0 AS sb04, 0 AS sb05
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
      conditionExtra = "AND spk_divisi IN (5) AND spk_jo_kode='MX'";
      selectMesinFields = `
                0 AS mt01, 0 AS mt02, 0 AS mt03, 0 AS mt04, 0 AS mt05, 0 AS mi,
                ROUND(IFNULL(ff.MX01, 0), 0) AS mx01, ROUND(IFNULL(ff.MX02, 0), 0) AS mx02,
                ROUND(IFNULL(ff.MX03, 0), 0) AS mx03, ROUND(IFNULL(ff.MX04, 0), 0) AS mx04,
                ROUND(IFNULL(ff.MX05, 0), 0) AS mx05,
                0 AS sb01, 0 AS sb02, 0 AS sb03, 0 AS sb04, 0 AS sb05
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
    // 3. KATEGORI SUBLIM (cbJenisIndex = '2')
    else if (cbJenisIndex === "2") {
      fieldJmlCetak = "ifnull(sb.jml_cetak_sublim, 0)";
      conditionExtra =
        "AND spk_nomor IN (SELECT DISTINCT lsbd_spk_nomor FROM tlhk_sublim_dtl)";
      selectMesinFields = `
                0 AS mt01, 0 AS mt02, 0 AS mt03, 0 AS mt04, 0 AS mt05, 0 AS mi,
                0 AS mx01, 0 AS mx02, 0 AS mx03, 0 AS mx04, 0 AS mx05,
                ROUND(IFNULL(sb.SB01, 0), 0) AS sb01, ROUND(IFNULL(sb.SB02, 0), 0) AS sb02,
                ROUND(IFNULL(sb.SB03, 0), 0) AS sb03, ROUND(IFNULL(sb.SB04, 0), 0) AS sb04,
                ROUND(IFNULL(sb.SB05, 0), 0) AS sb05
            `;
      joinLhkCetak = `
                LEFT JOIN (
                    SELECT lsbd_spk_nomor, 
                        SUM(IF(lsbd_jns_mesin='SB01',lsbd_jumlah,0)) SB01,
                        SUM(IF(lsbd_jns_mesin='SB02',lsbd_jumlah,0)) SB02,
                        SUM(IF(lsbd_jns_mesin='SB03',lsbd_jumlah,0)) SB03,
                        SUM(IF(lsbd_jns_mesin='SB04',lsbd_jumlah,0)) SB04,
                        SUM(IF(lsbd_jns_mesin='SB05',lsbd_jumlah,0)) SB05,
                        SUM(IFNULL(lsbd_jumlah,0)) jml_cetak_sublim
                    FROM tlhk_sublim_dtl
                    GROUP BY 1
                ) sb ON sb.lsbd_spk_nomor = spk_nomor`;
    }

    const sql = `
            SELECT 
                spk_nomor AS NOMOR, spk_memo, spk_tanggal, spk_dateline AS deadline, spk_nama,
                spk_statuskerja, spk_workshop, zz.DIVISI, jo_nama,
                IF(spk_jumlah_kirim >= spk_jumlah, "Closed", "Open") AS status,
                spk_panjang AS PANJANG, spk_lebar AS LEBAR, spk_kain AS KAIN, spk_gramasi, spk_finishing AS FINISHING,
                spk_jumlah, spk_jumlah_kirim,

                -- Logika Pengurangan PCS
                spk_jumlah - spk_jumlah_kirim AS krg_kirim,
                spk_jumlah - IFNULL(gg.jseaming, 0) AS krg_Seaming,
                spk_jumlah - IFNULL(gg.jmataayam, 0) AS krg_mataayam,
                spk_jumlah - IFNULL(gg.jcoly, 0) AS krg_coly,
                
                -- Logika Kurang Cetak PCS
                spk_jumlah - IF(spk_jumlah < ${fieldJmlCetak}, spk_jumlah, ${fieldJmlCetak}) - IFNULL(h.cetak_luarx, 0) AS krg_Cetak,

                -- Logika Pengurangan METER
                (spk_jumlah - spk_jumlah_kirim) * spk_panjang * IF(spk_divisi=5, IFNULL(spk_lebar, 0), 1) AS krg_kirim_meter,
                (spk_jumlah - IF(spk_jumlah < ${fieldJmlCetak}, spk_jumlah, ${fieldJmlCetak}) - IFNULL(h.cetak_luarx, 0)) * spk_panjang * IFNULL(spk_lebar, 0) AS krg_Cetak_meter,
                (spk_jumlah - IFNULL(gg.jcoly, 0)) * spk_panjang * IFNULL(spk_lebar, 0) AS krg_coly_meter,

                -- Data Mesin Dinamis
                ${selectMesinFields},

                IFNULL(h.cetak_luarx, 0) AS cetak_luarx

            FROM tspk
            INNER JOIN tcustomer ON spk_cus_kode = cus_kode
            LEFT JOIN tsales ON sal_kode = spk_sal_kode
            LEFT JOIN tjenisorder ON jo_kode = spk_jo_kode
            LEFT JOIN tdivisi zz ON zz.kode = spk_divisi
            
            -- Join Cetak Luar
            LEFT JOIN (
                SELECT poe_spk_nomor poe_Spk, SUM(IFNULL(poe_jumlah, 0)) cetak_luarx 
                FROM tpoexternal_hdr WHERE poe_cab='P05' GROUP BY 1
            ) h ON h.poe_spk = spk_nomor

            -- Join LHK Cetak
            ${joinLhkCetak}

            -- Join LHK Finishing
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
              AND spk_tanggal BETWEEN ? AND ?
            ORDER BY spk_nama
        `;

    const [rows] = await pool.query(sql, [startDate, endDate]);
    return rows;
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
