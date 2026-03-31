// backend/src/services/searchBarcode.service.js

const pool = require('../config/db.config');

/**
 * Helper untuk standarisasi error handling
 */
const throwDbError = (message, error) => { 
    throw new Error(`${message}: ${error.message}`); 
};

/**
 * SERVICE: Quick Search Barcode
 * Fungsi ini digunakan untuk melihat detail barang secara real-time 
 * tanpa harus membuat sesi stok opname terlebih dahulu.
 */
exports.findBarcodeDetail = async (barcode) => {
    try {
        const sql = `
            SELECT 
                m.mst_barcode AS Barcode,
                m.mst_brg_kode AS Kode,
                TRIM(b.brg_nama) AS Nama_Bahan,
                m.mst_gdg_kode AS Gudang,
                -- Menghitung stok akhir real-time: (Total Masuk - Total Keluar) * Panjang
                ROUND(
                    SUM(m.mst_stok_in * m.mst_panjang) - 
                    SUM(m.mst_stok_out * m.mst_panjang), 3
                ) AS Stok_Sistem,
                -- Info tambahan untuk verifikasi visual
                b.brg_satuan AS Satuan,
                'AVAILABLE' AS status_aktif
            FROM tmasterstok_mmt m
            LEFT JOIN tbarang_mmt b ON m.mst_brg_kode = b.brg_kode
            WHERE m.mst_barcode = ?
            GROUP BY 
                m.mst_barcode, 
                m.mst_brg_kode, 
                b.brg_nama, 
                m.mst_gdg_kode,
                b.brg_satuan
            HAVING Stok_Sistem > 0
            LIMIT 1;
        `;

        const [results] = await pool.query(sql, [barcode]);

        // Mengembalikan null jika barcode tidak ditemukan atau stok sudah 0
        return results[0] || null;

    } catch (error) {
        throwDbError('Gagal melakukan pencarian barcode real-time', error);
    }
};

/**
 * SERVICE: Search Multiple Barcodes
 * Opsional: Jika ingin melakukan pencarian banyak barcode sekaligus (bulk search)
 */
exports.findMultipleBarcodes = async (barcodes) => {
    if (!Array.isArray(barcodes) || barcodes.length === 0) return [];
    
    try {
        const sql = `
            SELECT 
                m.mst_barcode AS Barcode,
                TRIM(b.brg_nama) AS Nama_Bahan,
                ROUND(SUM(m.mst_stok_in * m.mst_panjang) - SUM(m.mst_stok_out * m.mst_panjang), 3) AS Stok_Sistem
            FROM tmasterstok_mmt m
            LEFT JOIN tbarang_mmt b ON m.mst_brg_kode = b.brg_kode
            WHERE m.mst_barcode IN (?)
            GROUP BY m.mst_barcode, b.brg_nama
            HAVING Stok_Sistem > 0;
        `;

        const [results] = await pool.query(sql, [barcodes]);
        return results;
    } catch (error) {
        throwDbError('Gagal melakukan pencarian massal barcode', error);
    }
};

// backend/src/services/searchBarcode.service.js

exports.getAllInventory = async (filters = {}) => {
    try {
        let queryParams = [];
        let conditions = [];

        // 1. Siapkan Filter berdasarkan input
        // Filter Stok harus > 0 (Selalu ada)
        conditions.push("Stok_Sistem > 0");

        // Filter Kode Barang
        if (filters.brg_kode) {
            conditions.push("Kode = ?");
            queryParams.push(filters.brg_kode);
        }

        // Filter Gudang (WH-16 / GPM)
        if (filters.gdg_kode) {
            conditions.push("Gudang = ?");
            queryParams.push(filters.gdg_kode);
        }

        // Gabungkan semua kondisi dengan AND
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const sql = `
            SELECT * FROM (
                SELECT 
                    m.mst_barcode AS Barcode,
                    m.mst_brg_kode AS Kode,
                    TRIM(b.brg_nama) AS Nama_Bahan,
                    m.mst_gdg_kode AS Gudang,
                    ROUND(
                        SUM(m.mst_stok_in * m.mst_panjang) - 
                        SUM(m.mst_stok_out * m.mst_panjang), 3
                    ) AS Stok_Sistem
                FROM tmasterstok_mmt m
                LEFT JOIN tbarang_mmt b ON m.mst_brg_kode = b.brg_kode
                GROUP BY 
                    m.mst_barcode, 
                    m.mst_brg_kode, 
                    b.brg_nama, 
                    m.mst_gdg_kode
            ) AS subquery
            ${whereClause}
            ORDER BY Nama_Bahan ASC, Barcode ASC;
        `;

        const [results] = await pool.query(sql, queryParams);
        return results;

    } catch (error) {
        // Log error untuk mempermudah debugging backend
        console.error("Database Error:", error.message);
        throw new Error('Gagal mengambil katalog stok: ' + error.message);
    }
};