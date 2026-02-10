// backend/services/lhkFinishing.service.js
const pool = require('../config/db.config');
const { format } = require('date-fns');

/**
 * Mengambil daftar master LHK Finishing
 * Menggunakan proteksi format tanggal seperti lhkCetak
 */
const getAllHeaders = async (startDate, endDate) => {
    try {
        // 1. Sinkronisasi Timezone: Paksa ke format yyyy-MM-dd string
        // Ini mencegah masalah pergeseran tanggal akibat timezone server/lokal
        const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
        const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

        const sql = `
            SELECT 
                t1.lfh_nomor AS Nomor, 
                t1.lfh_tanggal AS Tanggal, 
                t1.lfh_gdg_prod AS Gudang, 
                t2.gdg_nama AS Nama_Gudang, 
                t1.lfh_shift AS Shift,
                t1.lfh_user_create AS Operator,
                -- Logika pengecekan kelengkapan bahan pendukung
                (
                    SELECT IF(COUNT(*) > 0, 'N', 'Y')
                    FROM tlhk_finishingmmt_dtl d
                    WHERE d.lfd_lfh_nomor = t1.lfh_nomor
                    AND (
                        (d.lfd_j_mataayam > 0 AND (d.lfd_mataayam_qty IS NULL OR d.lfd_mataayam_qty = 0)) 
                        OR
                        ((d.lfd_xbanner_kode IS NOT NULL AND d.lfd_xbanner_kode <> '') AND (d.lfd_xbanner_qty IS NULL OR d.lfd_xbanner_qty = 0))
                        OR
                        ((d.lfd_rollupbanner_kode IS NOT NULL AND d.lfd_rollupbanner_kode <> '') AND (d.lfd_rollupbanner_qty IS NULL OR d.lfd_rollupbanner_qty = 0))
                    )
                ) AS Lengkap
            FROM tlhk_finishingmmt_hdr t1
            LEFT JOIN tgudang t2 ON (t2.gdg_kode = t1.lfh_gdg_prod)
            WHERE t1.lfh_tanggal BETWEEN ? AND ?
            ORDER BY t1.lfh_tanggal DESC, t1.lfh_nomor DESC
        `;

        // Gunakan .query (lebih fleksibel untuk string format)
        const [rows] = await pool.query(sql, [tglMulai, tglSelesai]);
        
        console.log(`[Finishing] Filter: ${tglMulai} to ${tglSelesai} | Found: ${rows.length}`);
        return rows;
    } catch (error) {
        console.error("Error in getAllHeaders Finishing:", error);
        throw new Error(`Gagal mengambil daftar LHK Finishing: ${error.message}`);
    }
};

/**
 * Mengambil detail item LHK Finishing
 */
const getDetailsByNomor = async (nomor) => {
    try {
        const sql = `
            SELECT 
                a.lfd_lfh_nomor AS Nomor, 
                a.lfd_spk_nomor AS Nomor_SPK,
                s.spk_nama AS Nama_SPK, 
                IFNULL(s.spk_panjang, 0) AS Panjang, 
                IFNULL(s.spk_lebar, 0) AS Lebar, 
                IFNULL(s.spk_jumlah, 0) AS J_Order,
                a.lfd_j_seaming AS J_Seaming,
                a.lfd_j_mataayam AS J_MataAyam,
                a.lfd_j_coly AS J_Coly,
                a.lfd_j_bs AS J_Bs,
                a.lfd_j_lebihcetak AS J_LebihCetak,
                a.lfd_mataayam_qty AS Mata_Ayam,
                a.lfd_xbanner_qty AS XBanner,
                a.lfd_plastik_qty AS Plastik,
                a.lfd_karung_qty AS karung,
                a.lfd_rollupbanner_qty AS Rullup_Banner,
                a.lfd_no_urut AS No_Urut
            FROM tlhk_finishingmmt_dtl a
            LEFT JOIN (
                SELECT spk_nomor, spk_nama, spk_jumlah, spk_panjang, spk_lebar FROM tspk
                UNION ALL
                SELECT mspk_nomor, mspk_nama, mspk_jumlah, mspk_panjang, mspk_lebar FROM tmemospk
            ) s ON (s.spk_nomor = a.lfd_spk_nomor)
            WHERE a.lfd_lfh_nomor = ?
            ORDER BY a.lfd_no_urut ASC
        `;
        
        const [rows] = await pool.query(sql, [nomor]);
        return rows;
    } catch (error) {
        console.error("Error getDetailsByNomor Finishing:", error);
        throw new Error(`Gagal mengambil detail Finishing: ${error.message}`);
    }
};

/**
 * Menghapus data LHK Finishing
 */
const deleteLhk = async (nomor) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query('DELETE FROM tlhk_finishingmmt_dtl WHERE lfd_lfh_nomor = ?', [nomor]);
        const [resHdr] = await conn.query('DELETE FROM tlhk_finishingmmt_hdr WHERE lfh_nomor = ?', [nomor]);

        if (resHdr.affectedRows === 0) {
            throw new Error('Data tidak ditemukan.');
        }

        await conn.commit();
        return { success: true, message: 'Berhasil dihapus.' };
    } catch (error) {
        if (conn) await conn.rollback();
        throw error;
    } finally {
        if (conn) conn.release();
    }
};

module.exports = {
    getAllHeaders,
    getDetailsByNomor,
    deleteLhk
};