const pool = require('../config/db.config');

exports.getStokByBarcode = async (barcode) => {
    try {
        const sql = `
            SELECT 
                m.mst_barcode AS Barcode,
                m.mst_brg_kode AS Kode,
                m.mst_gdg_kode AS Kode_Gudang,
                b.brg_nama AS Nama_Bahan,
                ROUND(SUM(m.mst_stok_in * m.mst_panjang) - SUM(m.mst_stok_out * m.mst_panjang), 3) AS Sisa_Panjang,
                MAX(m.mst_lebar) AS Lebar
            FROM tmasterstok_mmt m
            LEFT JOIN tbarang_mmt b ON m.mst_brg_kode = b.brg_kode
            WHERE m.mst_barcode = ?
            GROUP BY m.mst_barcode, m.mst_brg_kode, m.mst_gdg_kode, b.brg_nama;
        `;

        const [results] = await pool.query(sql, [barcode]);

        // 1. Cari yang di GPM (Gudang Produksi)
        const stokGPM = results.find(r => r.Kode_Gudang === 'GPM' && r.Sisa_Panjang > 0);
        if (stokGPM) return { data: stokGPM, status: 'READY' };

        // 2. Jika tidak ada di GPM, cari yang di WH-16 (Gudang Utama)
        const stokUtama = results.find(r => r.Kode_Gudang === 'WH-16' && r.Sisa_Panjang > 0);
        if (stokUtama) return { data: stokUtama, status: 'NEED_MUTATION' };

        return { data: null, status: 'NOT_FOUND' };
    } catch (error) {
        throw new Error(error.message);
    }
};