const pool = require('../config/db.config');
const moment = require('moment');

const lapMonTekstil = async (startDate, endDate) => {
  const tglMulai = moment(startDate).format('YYYY-MM-DD');
  const tglSelesai = moment(endDate).format('YYYY-MM-DD');

  const ssql = `
    SELECT spk.spk_perush_kode, 
           spk.spk_tanggal, 
           spk.spk_dateline, 
           spk.spk_nomor, 
           spk.spk_nama, 
           spk.spk_panjang, 
           spk.spk_lebar, 
           spk.spk_jumlah,
           spk.spk_kain,
           (spk.spk_jumlah * spk.spk_panjang) as order_meter,
           IFNULL(zz.jml_cetak, 0) as jmlcetak,
           (spk.spk_jumlah - IFNULL(zz.jml_cetak, 0)) as jmlkurang,
           zz.*
    FROM tspk spk
    LEFT JOIN (
        SELECT 
            ltd_spk_nomor AS Nomor_SPK,
            MAX(lth_tanggal) as Tanggal_LHK,
            SUM(ltd_qty_Cetak) as jml_cetak,
            SUM(ltd_qty_Cetak * ANY_VALUE(x.spk_panjang)) as cetak_meter,
            SUM(IF(ltd_jns_mesin='MX01', ltd_qty_Cetak, 0)) as mx01,
            SUM(IF(ltd_jns_mesin='MX02', ltd_qty_Cetak, 0)) as mx02,
            SUM(IF(ltd_jns_mesin='MX01', ltd_qty_Cetak, 0) * ANY_VALUE(x.spk_panjang)) as jmx01,
            SUM(IF(ltd_jns_mesin='MX02', ltd_qty_Cetak, 0) * ANY_VALUE(x.spk_panjang)) as jmx02,
            ANY_VALUE(u.sup_nama) as sup_nama
        FROM tlhk_tekstilmmt_dtl a
        INNER JOIN tlhk_tekstilmmt_hdr b ON b.lth_nomor = a.ltd_lth_nomor
        LEFT JOIN (
            SELECT spk_nomor, spk_panjang FROM tspk
            UNION ALL
            SELECT mspk_nomor, mspk_panjang FROM tmemospk
        ) x ON x.spk_nomor = a.ltd_spk_nomor
        LEFT JOIN tbarang_mmt ON brg_kode = ltd_brg_kode
        LEFT JOIN (
            SELECT brg_kode, sup_nama 
            FROM tbarang_mmt g 
            LEFT JOIN tsupplier h ON brg_sup_kode = sup_kode
        ) u ON u.brg_kode = a.ltd_brg_kode
        WHERE b.lth_tanggal BETWEEN ? AND ?
        GROUP BY ltd_spk_nomor
    ) zz ON zz.Nomor_SPK = spk.spk_nomor
    WHERE spk.spk_tanggal BETWEEN ? AND ?
      AND spk.spk_aktif = 'Y'
      AND spk.spk_divisi = 5
      AND SUBSTR(spk.spk_nomor, 4, 2) = 'MX'
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

module.exports = { lapMonTekstil };