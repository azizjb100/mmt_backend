// backend/src/services/lhkPola.service.js
const pool = require("../config/db.config");

const getLHKPolaLookup = async () => {
  try {
    const sql = `
      SELECT 
        -- Header LHK Pola
        h.lhkp_nomor AS lhk_nomor,
        h.lhkp_tanggal AS lhk_tanggal,
        h.lhkp_keterangan AS lhk_keterangan,
        h.lhkp_pembuat_pola,
        h.lhkp_pembuat_marker,
        
        -- Detail Marker
        m.ldm_id,
        m.ldm_urut AS marker_urut,
        m.ldm_spk_nomor AS marker_spk_nomor,
        m.ldm_lebar_kain,
        m.ldm_size AS marker_size,
        m.ldm_tujuan_proses,
        m.ldm_mesin,
        m.ldm_keterangan AS marker_keterangan,
        
        -- Detail Grading (Diambil berdasarkan nomor dokumen yang sama)
        g.ldg_id,
        g.ldg_urut AS grading_urut,
        g.ldg_spk_nomor AS grading_spk_nomor,
        g.ldg_divisi,
        g.ldg_grading_size,
        g.ldg_panjang,
        g.ldg_lebar,
        g.ldg_keterangan AS grading_keterangan
        
      FROM tlhkpola_hdr h
      -- Join utama ke marker
      LEFT JOIN tlhkpola_marker_dtl m ON h.lhkp_nomor = m.ldm_nomor
      -- Join ke grading disamakan berdasarkan nomor dokumen (dan SPK jika diperlukan agar lebih akurat)
      LEFT JOIN tlhkpola_grading_dtl g ON h.lhkp_nomor = g.ldg_nomor 
        AND (m.ldm_spk_nomor = g.ldg_spk_nomor OR g.ldg_spk_nomor IS NULL)
      ORDER BY 
        h.lhkp_tanggal DESC, 
        h.lhkp_nomor DESC, 
        m.ldm_urut ASC
    `;

    const [rows] = await pool.execute(sql);
    return rows;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getLHKPolaLookup,
};
