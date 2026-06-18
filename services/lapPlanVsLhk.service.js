// backend/src/services/laporanKomparasi.service.js

const pool = require('../config/db.config');
const { format } = require('date-fns');

/**
 * Mengambil Laporan Komparasi Realisasi Produksi MMT (Plan VS LHK)
 * Berdasarkan Periode Tanggal LHK / Tanggal Estimasi Planning
 */
exports.getPlanVsLhkReport = async (startDate, endDate) => {
    try {
        const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
        const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

        // Parameter dikirim 4 kali karena query menggunakan UNION ALL
        const params = [tglMulai, tglSelesai, tglMulai, tglSelesai];

        const sql = `
            SELECT 
                combine.Mesin,
                combine.NomorSPK,
                combine.NamaSPK,
                combine.Bahan,
                combine.Lebar,
                combine.Panjang,
                SUM(combine.Plan_Qty) AS Plan_Qty,
                SUM(combine.Plan_M2) AS Plan_M2,
                SUM(combine.Lhk_Qty) AS Lhk_Qty,
                SUM(combine.Lhk_M2) AS Lhk_M2,
                -- Deviasi dalam satuan M2 (LHK - Plan)
                (SUM(combine.Lhk_M2) - SUM(combine.Plan_M2)) AS Deviasi_M2,
                -- Persentase Pencapaian Target Cetak
                IF(SUM(combine.Plan_M2) > 0, ROUND((SUM(combine.Lhk_M2) / SUM(combine.Plan_M2)) * 100, 1), 0) AS Persentase
            FROM (
                
                -- ====================================================================
                -- BAGIAN 1: Ambil data dari PLANNING (Meskipun LHK cetak-nya belum ada)
                -- ====================================================================
                SELECT 
                    p.plan_mesin AS Mesin,
                    p.plan_spk AS NomorSPK,
                    s.spk_nama AS NamaSPK,
                    s.spk_kain AS Bahan,
                    IFNULL(s.spk_lebar, 0) AS Lebar,
                    IFNULL(s.spk_panjang, 0) AS Panjang,
                    p.plan_cetak AS Plan_Qty,
                    -- Rumus M2: Panjang x Lebar x Qty Cetak Terencana
                    ROUND(IFNULL(s.spk_panjang, 0) * IFNULL(s.spk_lebar, 0) * IFNULL(p.plan_cetak, 0), 2) AS Plan_M2,
                    0 AS Lhk_Qty,
                    0 AS Lhk_M2
                FROM tplanningspk_mmt p
                LEFT JOIN tspk s ON s.spk_nomor = p.plan_spk
                WHERE p.plan_tanggal BETWEEN ? AND ?

                UNION ALL

                -- ====================================================================
                -- BAGIAN 2: Ambil data dari LHK REALISASI OPERATOR (Meskipun tidak di-planning)
                -- ====================================================================
                SELECT 
                    h.lmesin AS Mesin,
                    d.ld_spk_nomor AS NomorSPK,
                    s.spk_nama AS NamaSPK,
                    s.spk_kain AS Bahan,
                    IFNULL(s.spk_lebar, 0) AS Lebar,
                    IFNULL(s.spk_panjang, 0) AS Panjang,
                    0 AS Plan_Qty,
                    0 AS Plan_M2,
                    d.ld_total_qtycetak AS Lhk_Qty,
                    -- Ambil nilai m2_cetak riil yang sudah dikalkulasi atau hitung manual jika null
                    ROUND(IFNULL(s.spk_panjang, 0) * IFNULL(s.spk_lebar, 0) * IFNULL(d.ld_total_qtycetak, 0), 2) AS Lhk_M2
                FROM tlhk_mesin_dtl d
                INNER JOIN tlhk_mesin_hdr h ON h.lnomor = d.ld_lnomor
                LEFT JOIN tspk s ON s.spk_nomor = d.ld_spk_nomor
                WHERE h.ltanggal BETWEEN ? AND ?
                
            ) AS combine
            GROUP BY combine.Mesin, combine.NomorSPK, combine.NamaSPK, combine.Bahan, combine.Lebar, combine.Panjang
            ORDER BY combine.Mesin ASC, combine.NomorSPK ASC
        `;

        const [rows] = await pool.query(sql, params);
        return rows;

    } catch (error) {
        console.error("Error in getPlanVsLhkReport:", error.message);
        throw new Error(`Gagal memuat laporan komparasi: ${error.message}`);
    }
};