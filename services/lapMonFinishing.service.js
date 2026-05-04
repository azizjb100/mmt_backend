const pool = require('../config/db.config');
const moment = require('moment');

const lapMonFinishing = async (startDate, endDate) => {
  const tglMulai = moment(startDate).format('YYYY-MM-DD');
  const tglSelesai = moment(endDate).format('YYYY-MM-DD');

  const ssql = `
    SELECT 
        spk.spk_perush_kode, 
        spk.spk_tanggal, 
        spk.spk_dateline, 
        spk.spk_nomor, 
        spk.spk_nama, 
        spk.spk_panjang, 
        spk.spk_lebar, 
        spk.spk_jumlah,
        spk.spk_kain,
        zz.*, 
        (spk.spk_jumlah * spk.spk_panjang * spk.spk_lebar) as order_meter, 
        IFNULL(zz.Jml_seaming, 0) as jmlseaming, 
        IFNULL(zz.Jml_mataayam, 0) as jmlmataayam, 
        IFNULL(zz.Jml_coly, 0) as jmlcoly, 
        IFNULL(zz.cetak_luarx, 0) as cetak_luar 
    FROM tspk spk
    LEFT JOIN (
        SELECT 
            a.lfd_spk_nomor AS Nomor_SPK,
            SUM(a.lfd_j_seaming) + IFNULL(MAX(h.cetak_luarx), 0) AS Jml_seaming, 
            SUM(a.lfd_j_mataayam) + IFNULL(MAX(h.cetak_luarx), 0) AS Jml_mataayam, 
            SUM(a.lfd_j_coly) + IFNULL(MAX(h.cetak_luarx), 0) AS Jml_coly, 
            
            (MAX(x.spk_jumlah) - SUM(a.lfd_j_seaming) - IFNULL(MAX(h.cetak_luarx), 0)) AS k_seaming, 
            (MAX(x.spk_jumlah) - SUM(a.lfd_j_mataayam) - IFNULL(MAX(h.cetak_luarx), 0)) AS k_mataayam, 
            (MAX(x.spk_jumlah) - SUM(a.lfd_j_coly) - IFNULL(MAX(h.cetak_luarx), 0)) AS k_coly,
            IFNULL(MAX(h.cetak_luarx), 0) AS cetak_luarx
        FROM tlhk_finishingmmt_dtl a 
        INNER JOIN tlhk_finishingmmt_hdr b ON b.lfh_nomor = a.lfd_lfh_nomor
        LEFT JOIN (
            SELECT spk_nomor, spk_jumlah FROM tspk
            UNION ALL 
            SELECT mspk_nomor, mspk_jumlah FROM tmemospk
        ) x ON x.spk_nomor = a.lfd_spk_nomor
        LEFT JOIN (
            SELECT poe_spk_nomor, SUM(IFNULL(poe_jumlah, 0)) AS cetak_luarx 
            FROM tpoexternal_hdr 
            WHERE poe_cab = 'P05' 
            GROUP BY poe_spk_nomor
        ) h ON h.poe_spk_nomor = a.lfd_spk_nomor 
        WHERE b.lfh_tanggal BETWEEN ? AND ?
        GROUP BY a.lfd_spk_nomor
    ) zz ON zz.Nomor_SPK = spk.spk_nomor
    WHERE spk.spk_tanggal BETWEEN ? AND ?
      AND spk.spk_aktif = 'Y' 
      AND spk.spk_divisi = 5 
      AND SUBSTR(spk.spk_nomor, 4, 2) = 'MT'
    ORDER BY spk.spk_tanggal ASC, spk.spk_nomor ASC;
  `;

  const params = [tglMulai, tglSelesai, tglMulai, tglSelesai];

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(ssql, params);
    return rows;
  } finally {
    connection.release();
  }
};

module.exports = { lapMonFinishing };