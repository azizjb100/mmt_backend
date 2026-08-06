const pool = require("../config/db.config");
const moment = require("moment");

const lapMonCetakPaperprint = async (startDate, endDate) => {
  const tglMulai = moment(startDate).format("YYYY-MM-DD");
  const tglSelesai = moment(endDate).format("YYYY-MM-DD");

  const ssql = `
    SELECT 
        spk.spk_perush_kode AS PERUSH,
        IFNULL(DATE_FORMAT(zz.Tanggal, '%Y-%m-%d'), '-') AS TANGGAL_LHK,
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

        -- Grouping PCS berdasarkan Mesin Sublim / Lokasi (SB01 - SB05)
        IFNULL(zz.sb01, 0) AS PCS_SB01,
        IFNULL(zz.sb02, 0) AS PCS_SB02,
        IFNULL(zz.sb03, 0) AS PCS_SB03,
        IFNULL(zz.sb04, 0) AS PCS_SB04,
        IFNULL(zz.sb05, 0) AS PCS_SB05,
        IFNULL(zz.Jml_Cetak, 0) AS JUMLAH_PCS,

        -- Grouping METER (Akumulasi lsbd_j_meter per Mesin Sublim)
        IFNULL(zz.jsb01, 0) AS METER_SB01,
        IFNULL(zz.jsb02, 0) AS METER_SB02,
        IFNULL(zz.jsb03, 0) AS METER_SB03,
        IFNULL(zz.jsb04, 0) AS METER_SB04,
        IFNULL(zz.jsb05, 0) AS METER_SB05,
        IFNULL(zz.total_m2, 0) AS JUMLAH_METER

    FROM tspk spk
    LEFT JOIN (
        SELECT 
            res.lsbd_spk_nomor AS Nomor_SPK,
            MAX(res.lsb_tanggal) AS Tanggal,
            SUM(res.lsbd_jumlah) AS Jml_Cetak,
            SUM(res.lsbd_j_meter) AS total_m2,
            
            -- Grouping PCS per Mesin (Menggunakan lsbd_lokasi)
            SUM(IF(res.lsbd_lokasi='SB01', res.lsbd_jumlah, 0)) AS sb01,
            SUM(IF(res.lsbd_lokasi='SB02', res.lsbd_jumlah, 0)) AS sb02,
            SUM(IF(res.lsbd_lokasi='SB03', res.lsbd_jumlah, 0)) AS sb03,
            SUM(IF(res.lsbd_lokasi='SB04', res.lsbd_jumlah, 0)) AS sb04,
            SUM(IF(res.lsbd_lokasi='SB05', res.lsbd_jumlah, 0)) AS sb05,

            -- Grouping METER per Mesin (Menggunakan lsbd_lokasi)
            SUM(IF(res.lsbd_lokasi='SB01', res.lsbd_j_meter, 0)) AS jsb01,
            SUM(IF(res.lsbd_lokasi='SB02', res.lsbd_j_meter, 0)) AS jsb02,
            SUM(IF(res.lsbd_lokasi='SB03', res.lsbd_j_meter, 0)) AS jsb03,
            SUM(IF(res.lsbd_lokasi='SB04', res.lsbd_j_meter, 0)) AS jsb04,
            SUM(IF(res.lsbd_lokasi='SB05', res.lsbd_j_meter, 0)) AS jsb05,
            
            IFNULL(h.cetak_luarx, 0) AS cetak_luarx

        FROM (
            SELECT 
                d.lsbd_spk_nomor, 
                h.lsb_tanggal, 
                d.lsbd_lokasi, 
                d.lsbd_jumlah, 
                IFNULL(d.lsbd_j_meter, (d.lsbd_panjang * d.lsbd_lebar * d.lsbd_jumlah)) AS lsbd_j_meter
            FROM tlhk_sublim_dtl d
            INNER JOIN tlhk_sublim_hdr h ON h.lsb_nomor = d.lsbd_lsb_nomor
            WHERE h.lsb_status = 'POSTED' -- Hanya mengambil data LHK yang sudah POSTED
        ) res
        LEFT JOIN (
            SELECT poe_spk_nomor, 
                   SUM(IFNULL(poe_jumlah, 0)) AS cetak_luarx
            FROM tpoexternal_hdr
            WHERE poe_cab='P05'
            GROUP BY poe_spk_nomor
        ) h ON h.poe_spk_nomor = res.lsbd_spk_nomor
        GROUP BY res.lsbd_spk_nomor
    ) zz ON zz.Nomor_SPK = spk.spk_nomor

    WHERE spk.spk_aktif = 'Y'
      AND spk.spk_tanggal BETWEEN ? AND ?

    ORDER BY spk.spk_tanggal ASC, spk.spk_nomor ASC;
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

module.exports = { lapMonCetakPaperprint };
