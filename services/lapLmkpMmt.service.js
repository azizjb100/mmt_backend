const pool = require('../config/db.config');

const throwDbError = (message, error) => {
    console.error(message, error.message);
    throw new Error(message + ': ' + error.message);
};

exports.getMonitoringData = async (cbJenisIndex, startDate, endDate) => {
    try {
        let joKode = '';
        let conditionExtra = '';
        let joinLhkCetak = '';
        let fieldJmlCetak = '';

        // 1. Replikasi Logika Cabang (MT, MX, Sublim) dari Delphi
        if (cbJenisIndex === '0') { // MT
            joKode = 'MT';
            fieldJmlCetak = 'ifnull(ee.jml_cetak_mmt, 0)';
            conditionExtra = "AND spk_divisi IN (5) AND spk_jo_kode='MT'";
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
        else if (cbJenisIndex === '1') { // MX
            joKode = 'MX';
            fieldJmlCetak = 'ifnull(ff.jml_cetak_tekstil, 0)';
            conditionExtra = "AND spk_divisi IN (5) AND spk_jo_kode='MX'";
            joinLhkCetak = `
                LEFT JOIN (
                    SELECT ltd_spk_nomor, SUM(IFNULL(ltd_qty_cetak,0)) jml_cetak_tekstil
                    FROM tlhk_tekstilmmt_dtl
                    GROUP BY 1
                ) ff ON ff.ltd_spk_nomor = spk_nomor`;
        }
        else if (cbJenisIndex === '2') { // SUBLIM
            joKode = 'SUBLIM';
            fieldJmlCetak = 'ifnull(ff.jml_cetak_sublim, 0)';
            conditionExtra = "AND spk_nomor IN (SELECT DISTINCT lsbd_spk_nomor FROM tlhk_sublim_dtl)";
            joinLhkCetak = `
                LEFT JOIN (
                    SELECT lsbd_spk_nomor, SUM(IFNULL(lsbd_jumlah,0)) jml_cetak_sublim
                    FROM tlhk_sublim_dtl
                    GROUP BY 1
                ) ff ON ff.lsbd_spk_nomor = spk_nomor`;
        }

        const sql = `
            SELECT 
                spk_nomor AS NOMOR, spk_memo, spk_tanggal, spk_dateline AS deadline, spk_nama,
                spk_statuskerja, spk_workshop, zz.DIVISI, jo_nama,
                IF(spk_jumlah_kirim >= spk_jumlah, "Closed", "Open") AS status,
                spk_panjang AS PANJANG, spk_lebar AS LEBAR, spk_kain AS KAIN, spk_gramasi, spk_finishing AS FINISHING,
                spk_jumlah, spk_jumlah_kirim,

                -- Logika Pengurangan PCS (Sesuai Delphi)
                spk_jumlah - spk_jumlah_kirim AS krg_kirim,
                spk_jumlah - IFNULL(gg.jseaming, 0) AS krg_Seaming,
                spk_jumlah - IFNULL(gg.jmataayam, 0) AS krg_mataayam,
                spk_jumlah - IFNULL(gg.jcoly, 0) AS krg_coly,
                
                -- Logika Kurang Cetak PCS (Detail Delphi)
                spk_jumlah - IF(spk_jumlah < ${fieldJmlCetak}, spk_jumlah, ${fieldJmlCetak}) - IFNULL(h.cetak_luarx, 0) AS krg_Cetak,

                -- Logika Pengurangan METER (Sesuai Delphi)
                (spk_jumlah - spk_jumlah_kirim) * spk_panjang * IF(spk_divisi=5, IFNULL(spk_lebar, 0), 1) AS krg_kirim_meter,
                (spk_jumlah - IF(spk_jumlah < ${fieldJmlCetak}, spk_jumlah, ${fieldJmlCetak}) - IFNULL(h.cetak_luarx, 0)) * spk_panjang * IFNULL(spk_lebar, 0) AS krg_Cetak_meter,
                (spk_jumlah - IFNULL(gg.jcoly, 0)) * spk_panjang * IFNULL(spk_lebar, 0) AS krg_coly_meter,

                -- Data Mesin (Hanya untuk MT/cbJenisIndex 0)
                ROUND(IFNULL(ee.MT01, 0), 0) as mt01, ROUND(IFNULL(ee.MT02, 0), 0) as mt02,
                ROUND(IFNULL(ee.MT03, 0), 0) as mt03, ROUND(IFNULL(ee.MT04, 0), 0) as mt04,
                ROUND(IFNULL(ee.MT05, 0), 0) as mt05, ROUND(IFNULL(ee.MI, 0), 0) as mi,
                IFNULL(h.cetak_luarx, 0) as cetak_luarx

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

            -- Join LHK Cetak (Dinamis berdasarkan jenis)
            ${joinLhkCetak}

            -- Join LHK Finishing (Seaming, Mata Ayam, Coly)
            LEFT JOIN (
                SELECT lfd_spk_nomor, 
                       SUM(lfd_j_Seaming) jseaming, 
                       SUM(lfd_j_mataayam) jmataayam, 
                       SUM(lfd_j_coly) jcoly 
                FROM tlhk_finishingmmt_dtl 
                GROUP BY 1
            ) gg ON gg.lfd_spk_nomor = spk_nomor

            WHERE spk_aktif = 'Y' 
              AND spk_close = 0
              ${conditionExtra}
              AND spk_tanggal BETWEEN ? AND ?
            ORDER BY spk_nama
        `;

        const [rows] = await pool.query(sql, [startDate, endDate]);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data LMKP', error);
    }
};

exports.getKapasitasMesin = async (cbJenisIndex) => {
    try {
        let sql = '';
        if (cbJenisIndex === '0') {
            sql = "SELECT SUM(msn_kapasitas) output FROM tmesin_mmt WHERE msn_JENIS='C'";
        } else {
            sql = "SELECT SUM(msn_kapasitas) output FROM tmesin_mmt WHERE msn_JENIS='T'";
        }

        const [rows] = await pool.query(sql);
        return rows[0]?.output || 0;
    } catch (error) {
        throwDbError('Gagal mengambil kapasitas mesin', error);
    }
};