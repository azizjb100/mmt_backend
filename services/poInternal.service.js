// backend/src/services/poInternal.service.js
const pool = require('../config/db.config');

const getPOInternalLookup = async () => {
  try {
    const sql = `
      SELECT 
        h.poi_nomor, 
        h.poi_tanggal, 
        h.poi_spk_nomor, 
        d.poid_size, 
        d.poid_jumlah,
        IFNULL(s.spk_nama, m.mspk_nama) as spk_nama,
        IFNULL(s.spk_panjang, m.mspk_panjang) as spk_panjang,
        IFNULL(s.spk_lebar, m.mspk_lebar) as spk_lebar,
        /* Hitung sisa: Join ke header (a) untuk mendapatkan poisj_nomorpo */
        (d.poid_jumlah - IFNULL((
          SELECT SUM(i.poisjd_jumlah) 
          FROM tpointernalsj_dtl i 
          INNER JOIN tpointernalsj_hdr a ON a.poisj_nomor = i.poisjd_nomor
          WHERE a.poisj_nomorpo = h.poi_nomor 
          AND i.poisjd_bhn_kode = d.poid_bhn_kode
          AND i.poisjd_size = d.poid_size
        ), 0)) as sisa_qty
      FROM tpointernal_hdr h
      INNER JOIN tpointernal_dtl d ON h.poi_nomor = d.poid_nomor
      LEFT JOIN tspk s ON h.poi_spk_nomor = s.spk_nomor
      LEFT JOIN tmemospk m ON h.poi_spk_nomor = m.mspk_nomor
      WHERE h.poi_sup = 'P05' 
      AND d.poid_bhn_kode = 'LL-000400'
      AND h.poi_close = 'N'
      ORDER BY h.poi_tanggal DESC
    `;

    const [rows] = await pool.execute(sql);
    return rows;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getPOInternalLookup
};