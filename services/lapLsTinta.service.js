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
                '-' AS Spesifikasi,
                
                -- STOCK AWAL
                IFNULL(sa.awal_pcs, 0) AS stok_awal,
                IFNULL(sa.awal_ket, 0) AS stok_Awal2,

                -- MASUK (PENERIMAAN)
                IFNULL(mutasi.terima_pcs, 0) AS terima,
                IFNULL(mutasi.terima_ket, 0) AS terima2,

                -- KELUAR (PEMAKAIAN)
                IFNULL(mutasi.keluar_pcs, 0) AS keluar,
                IFNULL(mutasi.keluar_ket, 0) AS keluar2,

                -- RETUR / SISA PRODUKSI (KOREKSI)
                IFNULL(mutasi.retur_pcs, 0) AS Retur_Prod,
                IFNULL(mutasi.retur_ket, 0) AS retur_prod2,

                -- STOCK AKHIR
                (IFNULL(sa.awal_pcs, 0) + IFNULL(mutasi.terima_pcs, 0) - IFNULL(mutasi.keluar_pcs, 0) + IFNULL(mutasi.retur_pcs, 0)) AS Stok_Akhir,
                (IFNULL(sa.awal_ket, 0) + IFNULL(mutasi.terima_ket, 0) - IFNULL(mutasi.keluar_ket, 0) + IFNULL(mutasi.retur_ket, 0)) AS stok_akhir2
            
            FROM tobat o
            
            -- Subquery Saldo Awal (Mutasi < startDate)
            LEFT JOIN (
                SELECT 
                    mst_brg_kode, 
                    SUM(mst_stok_in - mst_stok_out) AS awal_pcs,
                    -- Contoh KET: Total Volume (Panjang x Lebar x Qty)
                    SUM((mst_stok_in - mst_stok_out) * IF(mst_panjang > 0, mst_panjang * mst_lebar, 1)) AS awal_ket
                FROM tmasterstok_obat
                WHERE mst_tanggal < ?
                GROUP BY mst_brg_kode
            ) sa ON o.o_kode = sa.mst_brg_kode

            -- Subquery Mutasi Periode Berjalan (startDate s/d endDate)
            LEFT JOIN (
                SELECT 
                    mst_brg_kode,
                    -- Masuk
                    SUM(IF(mst_type = 'PENERIMAAN' OR (mst_stok_in > 0 AND mst_type <> 'KOREKSI'), mst_stok_in, 0)) AS terima_pcs,
                    SUM(IF(mst_type = 'PENERIMAAN', mst_stok_in * IF(mst_panjang > 0, mst_panjang * mst_lebar, 1), 0)) AS terima_ket,
                    
                    -- Keluar
                    SUM(IF(mst_type = 'PEMAKAIAN' OR (mst_stok_out > 0 AND mst_type <> 'KOREKSI'), mst_stok_out, 0)) AS keluar_pcs,
                    SUM(IF(mst_type = 'PEMAKAIAN', mst_stok_out * IF(mst_panjang > 0, mst_panjang * mst_lebar, 1), 0)) AS keluar_ket,
                    
                    -- Koreksi/Retur
                    SUM(IF(mst_type = 'KOREKSI', mst_stok_in - mst_stok_out, 0)) AS retur_pcs,
                    SUM(IF(mst_type = 'KOREKSI', (mst_stok_in - mst_stok_out) * IF(mst_panjang > 0, mst_panjang * mst_lebar, 1), 0)) AS retur_ket
                FROM tmasterstok_obat
                WHERE mst_tanggal BETWEEN ? AND ?
                GROUP BY mst_brg_kode
            ) mutasi ON o.o_kode = mutasi.mst_brg_kode

            WHERE o.o_aktif = 'Y'
            ORDER BY o.o_nama ASC
        `;

        const [rows] = await pool.query(sql, [sDate, sDate, eDate]);
        return rows;
    } catch (error) {
        console.error("Database Error:", error.message);
        throw error;
    }
};