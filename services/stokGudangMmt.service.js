const pool = require("../config/db.config");

exports.getStokByBarcode = async (barcode) => {
  try {
    const sql = `
            SELECT 
                m.mst_barcode AS Barcode,
                m.mst_brg_kode AS Kode,
                m.mst_gdg_kode AS Kode_Gudang,
                b.brg_nama AS Nama_Bahan,
                -- Gunakan IFNULL agar tidak menghasilkan NULL saat dikurangi
                CAST(ROUND(
                    SUM(IFNULL(m.mst_stok_in, 0) * IFNULL(m.mst_panjang, 0)) - 
                    SUM(IFNULL(m.mst_stok_out, 0) * IFNULL(m.mst_panjang, 0)), 
                3) AS DECIMAL(10,2)) AS Sisa_Panjang_Stok,
                MAX(m.mst_lebar) AS Lebar,

                -- 1. Ambil Nomor LHK Paling Akhir
                (
                    SELECT h.lnomor 
                    FROM tlhk_mesin_hdr h 
                    WHERE h.lbarcode_roll = m.mst_barcode 
                    ORDER BY h.ldate_create DESC 
                    LIMIT 1
                ) AS Lhk_Terakhir,

                -- 2. Ambil SISA METERAN PRESISI dari LHK Terakhir
                (
                    SELECT d.ld_sisameter
                    FROM tlhk_mesin_dtl d
                    INNER JOIN tlhk_mesin_hdr h ON h.lnomor = d.ld_lnomor
                    WHERE d.ld_barcode = m.mst_barcode OR h.lbarcode_roll = m.mst_barcode
                    ORDER BY h.ldate_create DESC, d.ld_urut DESC
                    LIMIT 1
                ) AS Sisa_Panjang_Lhk,

                -- Ambil Daftar Semua LHK
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

    // Jika barcode benar-benar tidak terdaftar di database
    if (!results || results.length === 0) {
      return { data: null, status: "NOT_FOUND" };
    }

    // Prioritaskan Gudang GPM jika ada
    const stokGPM = results.find((r) => r.Kode_Gudang === "GPM");
    const dataRes = stokGPM || results[0];

    // Hitung sisa panjang
    const finalSisaPanjang =
      dataRes.Sisa_Panjang_Lhk !== null &&
      dataRes.Sisa_Panjang_Lhk !== undefined
        ? parseFloat(dataRes.Sisa_Panjang_Lhk)
        : parseFloat(dataRes.Sisa_Panjang_Stok || 0);

    // Jika data ada tapi sisa meteran/stok <= 0
    if (finalSisaPanjang <= 0) {
      return {
        status: "EMPTY_STOCK", // Status khusus jika barang habis (bukan NOT_FOUND)
        data: {
          ...dataRes,
          Sisa_Panjang: 0,
          Lebar: parseFloat(dataRes.Lebar || 0),
        },
      };
    }

    return {
      status: dataRes.Kode_Gudang === "GPM" ? "READY" : "NEED_MUTATION",
      data: {
        ...dataRes,
        Sisa_Panjang: finalSisaPanjang,
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
