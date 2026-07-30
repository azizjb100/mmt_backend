const pool = require("../config/db.config");

exports.getStokByBarcode = async (barcode) => {
  try {
    const sql = `
            SELECT 
                m.mst_barcode AS Barcode,
                m.mst_brg_kode AS Kode,
                m.mst_gdg_kode AS Kode_Gudang,
                b.brg_nama AS Nama_Bahan,
                CAST(ROUND(SUM(m.mst_stok_in * m.mst_panjang) - SUM(m.mst_stok_out * m.mst_panjang), 3) AS DECIMAL(10,2)) AS Sisa_Panjang_Stok,
                MAX(m.mst_lebar) AS Lebar,

                -- 1. Ambil Nomor LHK Paling Akhir yang Menggunakan Roll Ini
                (
                    SELECT h.lnomor 
                    FROM tlhk_mesin_hdr h 
                    WHERE h.lbarcode_roll = m.mst_barcode 
                    ORDER BY h.ldate_create DESC 
                    LIMIT 1
                ) AS Lhk_Terakhir,

                -- 2. 🔥 KUNCI SYNC: Ambil SISA METERAN PRESISI dari LHK Terakhir tersebut
                (
    SELECT d.ld_sisameter
    FROM tlhk_mesin_dtl d
    INNER JOIN tlhk_mesin_hdr h ON h.lnomor = d.ld_lnomor
    WHERE d.ld_barcode = m.mst_barcode
    ORDER BY d.ld_id DESC  -- Atau h.lnomor DESC jika lnomor berurutan
    LIMIT 1
) AS Sisa_Panjang_Lhk

                -- Ambil Daftar Semua LHK yang Pernah Pakai Barcode Ini
                (
                    SELECT GROUP_CONCAT(h.lnomor SEPARATOR ', ')
                    FROM tlhk_mesin_hdr h
                    WHERE h.lbarcode_roll = m.mst_barcode
                ) AS All_Lhk_List

            FROM tmasterstok_mmt m
            LEFT JOIN tbarang_mmt b ON m.mst_brg_kode = b.brg_kode
            WHERE m.mst_barcode = ?
            GROUP BY m.mst_barcode, m.mst_brg_kode, m.mst_gdg_kode, b.brg_nama;
        `;

    const [results] = await pool.query(sql, [barcode]);

    if (!results || results.length === 0) {
      return { data: null, status: "NOT_FOUND" };
    }

    // Cari stok di GPM dulu, jika tidak ada baru ambil di gudang lain (WH-16)
    const stokGPM = results.find((r) => r.Kode_Gudang === "GPM");
    const dataRes = stokGPM || results[0];

    // PRIORITAS PANJANG BAHAN:
    // Gunakan Sisa_Panjang_Lhk (jika roll sudah pernah dipakai LHK sebelumnya),
    // Jika belum pernah dipakai LHK (roll baru murni), gunakan Sisa_Panjang_Stok.
    const finalSisaPanjang =
      dataRes.Sisa_Panjang_Lhk !== null &&
      dataRes.Sisa_Panjang_Lhk !== undefined
        ? parseFloat(dataRes.Sisa_Panjang_Lhk)
        : parseFloat(dataRes.Sisa_Panjang_Stok || 0);

    if (finalSisaPanjang <= 0) {
      return { data: null, status: "NOT_FOUND" };
    }

    return {
      status: dataRes.Kode_Gudang === "GPM" ? "READY" : "NEED_MUTATION",
      data: {
        ...dataRes,
        Sisa_Panjang: finalSisaPanjang, // Nilai 19.34 akan terambil di sini
        Lebar: parseFloat(dataRes.Lebar || 0),
        Lhk_Terakhir: dataRes.Lhk_Terakhir || null,
        All_Lhk_List: dataRes.All_Lhk_List || "",
      },
    };
  } catch (error) {
    console.error("Error getStokByBarcode:", error);
    throw new Error(`Gagal mengambil stok barcode: ${error.message}`);
  }
};
