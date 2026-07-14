// backend/src/services/lhkPola.service.js
const pool = require('../config/db.config');

const getLHKPolaLookup = async () => {
  try {
    const sql = `
      SELECT 
        -- Data dari Header (tlhkpola_hdr)
        h.lhk_nomor,
        h.lhk_tanggal,
        h.lhk_keterangan,
        
        -- Data dari Detail Marker (tlhkpola_marker_dtl)
        m.ldm_id,
        m.ldm_urut AS marker_urut,
        m.ldm_spk_nomor AS marker_spk_nomor,
        m.ldm_lebar_kain,
        m.ldm_size AS marker_size,
        m.ldm_tujuan_proses,
        m.ldm_mesin,
        m.ldm_keterangan AS marker_keterangan,
        
        -- Data dari Detail Grading (tlhkpola_grading_dtl)
        g.ldg_id,
        g.ldg_urut AS grading_urut,
        g.ldg_spk_nomor AS grading_spk_nomor,
        g.ldg_divisi,
        g.ldg_grading_size,
        g.ldg_keterangan AS grading_keterangan
        
      FROM tlhkpola_hdr h
      -- Join ke detail marker menggunakan ldm_nomor
      INNER JOIN tlhkpola_marker_dtl m ON h.lhk_nomor = m.ldm_nomor
      -- Join ke detail grading disamakan berdasarkan nomor dokumen dan sizenya (opsional/sesuaikan kebutuhan relasi bisnis Anda)
      LEFT JOIN tlhkpola_grading_dtl g ON h.lhk_nomor = g.ldg_nomor 
        AND m.ldm_size = g.ldg_grading_size
      ORDER BY 
        h.lhk_tanggal DESC, 
        h.lhk_nomor DESC, 
        m.ldm_urut ASC
    `;

    const [rows] = await pool.execute(sql);
    return rows;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getLHKPolaLookup
};