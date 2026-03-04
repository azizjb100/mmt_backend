
const pool = require("../config/db.config");
const { format } = require('date-fns');

exports.getLaporanStokObat = async (startDate, endDate) => {
    try {
        const sDate = format(new Date(startDate), 'yyyy-MM-dd');
        const eDate = format(new Date(endDate), 'yyyy-MM-dd');

        const sql = `
            SELECT 
                o.o_kode AS kode,
                o.o_nama AS Nama,
                o.o_satuan AS satuan,
                'TINTA' AS jb_nama,
                
                -- 1. STOK AWAL (Semua transaksi < startDate)
                IFNULL(sa.stok_awal, 0) AS stok_awal,

                -- 2. PENERIMAAN (Penerimaan di periode berjalan)
                IFNULL(mutasi.terima, 0) AS terima,

                -- 3. PENGELUARAN (Pemakaian di periode berjalan)
                IFNULL(mutasi.keluar, 0) AS keluar,

                -- 4. STOK AKHIR (Stok Awal + Terima - Keluar)
                (IFNULL(sa.stok_awal, 0) + IFNULL(mutasi.terima, 0) - IFNULL(mutasi.keluar, 0)) AS Stok_Akhir
            
            FROM tobat o
            
            -- Subquery Saldo Awal: Menghitung saldo bersih sebelum tanggal mulai
            LEFT JOIN (
                SELECT 
                    mst_brg_kode, 
                    SUM(mst_stok_in - mst_stok_out) AS stok_awal
                FROM tmasterstok_obat
                WHERE mst_tanggal < ? AND mst_aktif = 'Y'
                GROUP BY mst_brg_kode
            ) sa ON o.o_kode = sa.mst_brg_kode

            -- Subquery Mutasi: Menghitung aktivitas di dalam rentang tanggal
            LEFT JOIN (
                SELECT 
                    mst_brg_kode,
                    SUM(mst_stok_in) AS terima,
                    SUM(mst_stok_out) AS keluar
                FROM tmasterstok_obat
                WHERE (mst_tanggal BETWEEN ? AND ?) AND mst_aktif = 'Y'
                GROUP BY mst_brg_kode
            ) mutasi ON o.o_kode = mutasi.mst_brg_kode

            WHERE o.o_aktif = 'Y'
            ORDER BY o.o_nama ASC
        `;

        // Masukkan parameter: sDate untuk saldo awal, lalu sDate & eDate untuk mutasi
        const [rows] = await pool.query(sql, [sDate, sDate, eDate]);
        return rows;

    } catch (error) {
        console.error("Database Error:", error.message);
        throw error;
    }
};