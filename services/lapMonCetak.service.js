const pool = require('../config/db.config');
const moment = require('moment');

const lapMonCetak = async (startDate, endDate) => {

  const tglMulai = moment(startDate).format('YYYY-MM-DD');
  const tglSelesai = moment(endDate).format('YYYY-MM-DD');

  const ssql = `
    SELECT 
        spk.spk_perush_kode AS PERUSH,
        DATE_FORMAT(zz.Tanggal, '%Y-%m-%d') AS TANGGAL_LHK,
        DATE_FORMAT(spk.spk_tanggal, '%Y-%m-%d') AS TGL_SPK,
        DATE_FORMAT(spk.spk_dateline, '%Y-%m-%d') AS DEADLINE,
        spk.spk_nama AS NAMA_ORDER,
        spk.spk_panjang AS PANJANG,
        spk.spk_lebar AS LEBAR,
        spk.spk_nomor AS NO_SPK,
        spk.spk_jumlah AS ORDER_SPK_PCS,
        (spk.spk_jumlah * spk.spk_panjang * spk.spk_lebar) AS ORDER_SPK_METER,

        (spk.spk_jumlah - 
            (IFNULL(zz.Jml_Cetak, 0) + IFNULL(zz.cetak_luarx, 0))
        ) AS KURANG_VARIANT,

        IFNULL(zz.cetak_luarx, 0) AS CETAK_LUAR,

        -- PCS
        IFNULL(zz.mt01, 0) AS PCS_MT01,
        IFNULL(zz.mt02, 0) AS PCS_MT02,
        IFNULL(zz.mt03, 0) AS PCS_MT03,
        IFNULL(zz.mt04, 0) AS PCS_MT04,
        IFNULL(zz.mt05, 0) AS PCS_MT05,
        IFNULL(zz.Jml_Cetak, 0) AS JUMLAH_PCS,

        -- METER
        IFNULL(zz.jmt01, 0) AS METER_MT01,
        IFNULL(zz.jmt02, 0) AS METER_MT02,
        IFNULL(zz.jmt03, 0) AS METER_MT03,
        IFNULL(zz.jmt04, 0) AS METER_MT04,
        IFNULL(zz.jmt05, 0) AS METER_MT05,
        IFNULL(zz.cetak_meter, 0) AS JUMLAH_METER

    FROM tspk spk
    INNER JOIN (
        SELECT 
            X.Nomor_SPK,
            X.Tanggal,
            X.Jml_Cetak,
            X.mt01, X.mt02, X.mt03, X.mt04, X.mt05,

            (X.Jml_Cetak * y.spk_panjang * 
                IF(SUBSTR(y.spk_nomor,4,2)='MX',1,y.spk_lebar)
            ) AS cetak_meter,

            (X.mt01 * y.spk_panjang * 
                IF(SUBSTR(y.spk_nomor,4,2)='MX',1,y.spk_lebar)
            ) AS jmt01,

            (X.mt02 * y.spk_panjang * 
                IF(SUBSTR(y.spk_nomor,4,2)='MX',1,y.spk_lebar)
            ) AS jmt02,

            (X.mt03 * y.spk_panjang * 
                IF(SUBSTR(y.spk_nomor,4,2)='MX',1,y.spk_lebar)
            ) AS jmt03,

            (X.mt04 * y.spk_panjang * 
                IF(SUBSTR(y.spk_nomor,4,2)='MX',1,y.spk_lebar)
            ) AS jmt04,

            (X.mt05 * y.spk_panjang * 
                IF(SUBSTR(y.spk_nomor,4,2)='MX',1,y.spk_lebar)
            ) AS jmt05,

            IFNULL(h.cetak_luarx, 0) AS cetak_luarx

        FROM (
            SELECT 
                a.lcd_spk_nomor AS Nomor_SPK,
                MAX(b.lch_tanggal) AS Tanggal,
                SUM(a.lcd_qty_cetak) AS Jml_Cetak,
                SUM(IF(a.lcd_jns_mesin='MT01', a.lcd_qty_cetak,0)) AS mt01,
                SUM(IF(a.lcd_jns_mesin='MT02', a.lcd_qty_cetak,0)) AS mt02,
                SUM(IF(a.lcd_jns_mesin='MT03', a.lcd_qty_cetak,0)) AS mt03,
                SUM(IF(a.lcd_jns_mesin='MT04', a.lcd_qty_cetak,0)) AS mt04,
                SUM(IF(a.lcd_jns_mesin='MT05', a.lcd_qty_cetak,0)) AS mt05
            FROM tlhk_cetakmmt_dtl a
            INNER JOIN tlhk_cetakmmt_hdr b 
                ON b.lch_nomor = a.lcd_lch_nomor
            WHERE b.lch_tanggal BETWEEN ? AND ?
            GROUP BY a.lcd_spk_nomor
        ) X
        INNER JOIN tspk y ON y.spk_nomor = X.Nomor_SPK
        LEFT JOIN (
            SELECT poe_spk_nomor, 
                   SUM(IFNULL(poe_jumlah,0)) AS cetak_luarx
            FROM tpoexternal_hdr
            WHERE poe_cab='P05'
            GROUP BY poe_spk_nomor
        ) h ON h.poe_spk_nomor = X.Nomor_SPK
    ) zz ON zz.Nomor_SPK = spk.spk_nomor

    WHERE spk.spk_aktif='Y'
      AND spk.spk_divisi=5
      AND SUBSTR(spk.spk_nomor,4,2)='MT'

    ORDER BY zz.Tanggal ASC;
  `;

  const params = [tglMulai, tglSelesai];

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(ssql, params);
    return rows;
  } finally {
    connection.release();
  }
};

module.exports = { lapMonCetak };
