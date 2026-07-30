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

        -- 1. Ambil Nomor LHK Terakhir (Gabungan 3 Tabel LHK)
        (
          SELECT nomor_lhk
          FROM (
            -- LHK Mesin MMT (Barcode di Header)
            SELECT h.lnomor AS nomor_lhk, h.ldate_create AS created_at 
            FROM tlhk_mesin_hdr h 
            WHERE h.lbarcode_roll = ?

            UNION ALL

            -- LHK Proof MMT (Barcode di Detail)
            SELECT d.lprd_lpr_nomor AS nomor_lhk, h.ldate_create AS created_at 
            FROM tlhk_proofmmt_dtl d 
            INNER JOIN tlhk_proofmmt_hdr h ON h.lpr_nomor = d.lprd_lpr_nomor 
            WHERE d.lprd_barcode = ?

            UNION ALL

            -- LHK Mesin Tekstil (Barcode di Header 🔥)
            SELECT h.lth_nomor AS nomor_lhk, h.lth_date_Create AS created_at 
            FROM tlhk_mesintekstil_hdr h 
            WHERE h.lth_barcode = ?
          ) AS all_lhk
          ORDER BY created_at DESC
          LIMIT 1
        ) AS Lhk_Terakhir,

        -- 2. 🔥 KUNCI SYNC: Ambil Sisa Meteran Presisi Terakhir
        (
          SELECT sisa_meter
          FROM (
            -- Sisa Meter dari LHK Mesin MMT
            SELECT d.ld_sisameter AS sisa_meter, h.ldate_create AS created_at, d.ld_urut AS urut 
            FROM tlhk_mesin_dtl d 
            INNER JOIN tlhk_mesin_hdr h ON h.lnomor = d.ld_lnomor 
            WHERE d.ld_barcode = ?

            UNION ALL

            -- Sisa Meter dari LHK Proof MMT
            SELECT d.lprd_sisa_bahan AS sisa_meter, h.ldate_create AS created_at, d.lprd_no_urut AS urut 
            FROM tlhk_proofmmt_dtl d 
            INNER JOIN tlhk_proofmmt_hdr h ON h.lpr_nomor = d.lprd_lpr_nomor 
            WHERE d.lprd_barcode = ?

            UNION ALL

            -- Sisa Meter dari LHK Mesin Tekstil (Perhitungan Detail) 🔥
            SELECT (d.ltd_ambil_bahan - d.ltd_panjang_pakai) AS sisa_meter, h.lth_date_Create AS created_at, d.ltd_no_urut AS urut 
            FROM tlhk_mesintekstil_dtl d 
            INNER JOIN tlhk_mesintekstil_hdr h ON h.lth_nomor = d.ltd_lth_nomor 
            WHERE h.lth_barcode = ?
          ) AS all_sisa
          ORDER BY created_at DESC, urut DESC
          LIMIT 1
        ) AS Sisa_Panjang_Lhk,

        -- 3. Ambil Daftar Semua LHK yang Pernah Pakai Barcode Ini
        (
          SELECT GROUP_CONCAT(nomor_lhk SEPARATOR ', ')
          FROM (
            SELECT h.lnomor AS nomor_lhk FROM tlhk_mesin_hdr h WHERE h.lbarcode_roll = ?
            UNION
            SELECT d.lprd_lpr_nomor AS nomor_lhk FROM tlhk_proofmmt_dtl d WHERE d.lprd_barcode = ?
            UNION
            SELECT h.lth_nomor AS nomor_lhk FROM tlhk_mesintekstil_hdr h WHERE h.lth_barcode = ?
          ) AS unique_lhk
        ) AS All_Lhk_List

      FROM tmasterstok_mmt m
      LEFT JOIN tbarang_mmt b ON m.mst_brg_kode = b.brg_kode
      WHERE m.mst_barcode = ?
      GROUP BY m.mst_barcode, m.mst_brg_kode, m.mst_gdg_kode, b.brg_nama;
    `;

    // Array parameter binding untuk 10 placeholder (?)
    const queryParams = [
      barcode,
      barcode,
      barcode, // Subquery 1 (Lhk_Terakhir)
      barcode,
      barcode,
      barcode, // Subquery 2 (Sisa_Panjang_Lhk)
      barcode,
      barcode,
      barcode, // Subquery 3 (All_Lhk_List)
      barcode, // Utama (WHERE mst_barcode = ?)
    ];

    const [results] = await pool.query(sql, queryParams);

    if (!results || results.length === 0) {
      return { data: null, status: "NOT_FOUND" };
    }

    const stokGPM = results.find((r) => r.Kode_Gudang === "GPM");
    const dataRes = stokGPM || results[0];

    // Prioritas: Jika ada Sisa_Panjang_Lhk ambil itu, jika null ambil kalkulasi stok
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
