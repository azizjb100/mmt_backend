const pool = require("../config/db.config");
const { format } = require("date-fns");

// Konstanta Nomor Bukti
const NOMERATOR_MESIN = "MMT-LHK-S"; // Untuk tabel mesinsublim
const NOMERATOR_APP = "MMT-LHK-SA"; // Untuk tabel sublim (Approval)

/**
 * =============================================================================
 * 1. BAGIAN MESIN SUBLIM (Input Operator)
 * =============================================================================
 */

const accLhkPaperprint = async (nomor, user = "SYSTEM") => {
  // Update kolom lsb_acc menjadi 'ACC' (dan status jika diperlukan)
  const sql = `
    UPDATE tlhk_sublim_hdr 
    SET lsb_acc = 'ACC',
        lsb_user_modified = ?,
        lsb_date_modified = NOW()
    WHERE lsb_nomor = ?
  `;

  const [result] = await pool.query(sql, [user, nomor]);

  if (result.affectedRows === 0) {
    throw new Error(`Data LHK Sublim dengan nomor ${nomor} tidak ditemukan.`);
  }

  return { success: true, nomor };
};

const getAllHeaders = async (startDate, endDate, search = "") => {
  const tglMulai = format(new Date(startDate), "yyyy-MM-dd");
  const tglSelesai = format(new Date(endDate), "yyyy-MM-dd");

  const params = [tglMulai, tglSelesai];

  let sql = `
       SELECT 
    t1.lsb_nomor AS Nomor, 
    t1.lsb_shift AS Shift, 
    DATE_FORMAT(t1.lsb_tanggal, '%Y-%m-%d') AS Tanggal, 
    IFNULL(x.mesin_lokasi, 'SB01') AS Mesin,
    
    -- Status Utama & ACC
    IFNULL(t1.lsb_status, 'DRAFT') AS Status,
    IFNULL(t1.lsb_acc, '') AS Status_Acc,
    
    t1.lsb_panjang_bs AS lsb_panjang_bs,
    t1.lsb_lebar_bs AS lsb_lebar_bs,
    t1.lsb_gdg_kode AS Gudang,
    g.gdg_nama AS Nama_Gudang,
    
    t1.lsb_barcode AS Barcode_Roll,
    t1.lsb_brg_kode AS Kode_Bahan,
    t3.brg_nama AS Nama_Bahan,
    -- Cek Kelengkapan Bahan (Y / N)
    IF(LENGTH(IFNULL(t1.lsb_brg_kode, '')) > 0, 'Y', 'N') AS Lengkap,

    IFNULL(x.combined_spk, '-') AS NomorSPK,
    IFNULL(x.combined_spk_nama, '-') AS NamaOrder,
    IFNULL(x.qtytotalcetak, 0) AS TotalCetak,
    IFNULL(x.panjang_bahan_awal, 0) AS PanjangBahanAwal,
    IFNULL(x.sisa_akhir, 0) AS SisaMeterAkhir,
    IFNULL(x.total_luas_m2, 0) AS total_meter,
    
    CASE 
        WHEN x.sisa_akhir < 0 THEN ABS(x.sisa_akhir)
        ELSE 0 
    END AS NilaiSurplus,
    
    CASE 
        WHEN x.sisa_akhir > 0 THEN x.sisa_akhir
        ELSE 0 
    END AS NilaiMinus,

    t1.lsb_user_create AS Operator
FROM tlhk_sublim_hdr t1
LEFT JOIN tGUDANG g ON g.gdg_kode = t1.lsb_gdg_kode
LEFT JOIN tbarang_mmt t3 ON t3.brg_kode = t1.lsb_brg_kode
LEFT JOIN (
    SELECT 
        lsbd_lsb_nomor,
        MAX(lsbd_lokasi) AS mesin_lokasi,
        GROUP_CONCAT(DISTINCT lsbd_spk_nomor SEPARATOR ', ') AS combined_spk,
        GROUP_CONCAT(DISTINCT lsbd_spk_nama SEPARATOR ', ') AS combined_spk_nama,
        SUM(lsbd_jumlah) AS qtytotalcetak,
        SUM(lsbd_j_meter) AS total_luas_m2,
        MAX(lsbd_ambilbahan) AS panjang_bahan_awal,
        (
            SELECT (d2.lsbd_ambilbahan - d2.lsbd_panjang_pakai - h2.lsb_panjang_bs)
            FROM tlhk_sublim_dtl d2
            INNER JOIN tlhk_sublim_hdr h2 ON h2.lsb_nomor = d2.lsbd_lsb_nomor
            WHERE d2.lsbd_lsb_nomor = tlhk_sublim_dtl.lsbd_lsb_nomor 
            ORDER BY d2.lsbd_no_urut DESC LIMIT 1
        ) AS sisa_akhir
    FROM tlhk_sublim_dtl 
    GROUP BY lsbd_lsb_nomor
) x ON x.lsbd_lsb_nomor = t1.lsb_nomor
WHERE t1.lsb_tanggal BETWEEN ? AND ?
    `;

  if (search) {
    sql += ` AND (
            t1.lsb_nomor LIKE ? 
            OR t1.lsb_barcode LIKE ? 
            OR t3.brg_nama LIKE ? 
            OR x.combined_spk LIKE ? 
            OR x.combined_spk_nama LIKE ?
        ) `;
    const searchPattern = `%${search}%`;
    params.push(
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
    );
  }

  sql += ` ORDER BY t1.lsb_tanggal DESC, t1.lsb_nomor DESC`;

  const [rows] = await pool.query(sql, params);
  return rows;
};

const getDetailsByNomor = async (nomor) => {
  const sqlDetail = `
        SELECT 
            d.lsbd_lsb_nomor AS Nomor,
            d.lsbd_poi_nomor AS Poi_Nomor,
            d.lsbd_poid_size AS Poi_Size,
            d.lsbd_lokasi AS Lokasi, 
            d.lsbd_spk_nomor AS Nomor_SPK, 
            IF(LENGTH(d.lsbd_spk_nama) > 0, d.lsbd_spk_nama, x.spk_nama) AS Nama_SPK, 
            
            -- 🌟 Tambahkan ini agar nama komponen ter-load saat edit
            IFNULL(d.lsbd_komponen, 'ALL SET') AS lsbd_komponen,
            IFNULL(d.lsbd_komponen, 'ALL SET') AS Komponen,
            
            d.lsbd_panjang AS Panjang, 
            d.lsbd_lebar AS Lebar, 
            d.lsbd_jumlah_order AS J_Order, 
            d.lsbd_bahan AS Bahan, 
            d.lsbd_jumlah AS Jumlah,
            (d.lsbd_panjang * d.lsbd_lebar * d.lsbd_jumlah) AS Jumlah_Meter,
            
            -- Menarik data penunjang dari header
            h.lsb_panjang_bs AS lsb_panjang_bs,
            h.lsb_lebar_bs AS lsb_lebar_bs,
            h.lsb_tanggal AS lsb_tanggal,
            h.lsb_shift AS lsb_shift,
            h.lsb_gdg_kode AS lsb_gdg_kode,
            h.lsb_status AS lstatus,
            h.lsb_barcode AS Barcode_Roll,   -- 🌟 Barcode roll
            h.lsb_brg_kode AS Kode_Bahan,     -- 🌟 Kode barang
            d.lsbd_ambilbahan AS panjang_awal,
            d.lsbd_panjang_pakai AS panjang_terpakai,
            d.lsbd_sisameter AS lsbd_sisameter
        FROM tlhk_sublim_dtl d
        LEFT JOIN tlhk_sublim_hdr h ON h.lsb_nomor = d.lsbd_lsb_nomor 
        LEFT JOIN (
            SELECT spk_nomor, spk_nama FROM tspk 
            UNION ALL 
            SELECT mspk_nomor, mspk_nama FROM tmemospk 
        ) x ON x.spk_nomor = d.lsbd_spk_nomor 
        WHERE d.lsbd_lsb_nomor = ?
        ORDER BY d.lsbd_no_urut
    `;

  const [rows] = await pool.query(sqlDetail, [nomor]);
  return rows;
};

const saveLhkMesin = async (data) => {
  const { header, details } = data;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let nomorLhk = header.lsb_nomor;
    const currentStatus = header.lstatus || "DRAFT";
    const tanggalForm = header.lsb_tanggal;
    const gdgKode = header.lsb_gdg_kode || "GPM";
    const shiftForm = header.lsb_shift || 1;
    const userAction = header.kdUser || header.user_create || "SYSTEM";

    const panjangBs = parseFloat(header.panjang_bs || 0);
    const lebarBs = parseFloat(header.lebar_bs || 0);
    const formattedDate = format(new Date(tanggalForm), "yyyy-MM-dd");
    const formattedNow = format(new Date(), "yyyy-MM-dd HH:mm:ss");

    const usedBarcode = header.barcode_input || "";
    const usedKodeBahan = header.brg_kode || "";
    let maxAmbilPanjang = parseFloat(
      header.Panjang_bahan || header.panjang_bahan || 0,
    );
    const initialLebar = parseFloat(
      header.Lebar_bahan || header.lebar_bahan || 0,
    );

    // Penanganan Sisa Meter: Prioritas Manual -> Otomatis -> 0
    const sisaManual =
      header.sisa_panjang_manual ??
      header.sisa_manual ??
      header.sisaPanjangManual;
    const sisaOtomatis = header.sisabahan ?? header.sisa_panjang_otomatis ?? 0;

    const finalSisaMeter =
      sisaManual !== null &&
      sisaManual !== undefined &&
      String(sisaManual).trim() !== "" &&
      !isNaN(parseFloat(sisaManual))
        ? parseFloat(sisaManual)
        : parseFloat(sisaOtomatis);

    const uniqueSpks = [
      ...new Set(details.map((d) => d.spk_nomor).filter((s) => s)),
    ];
    const combinedSpkNomor = uniqueSpks.join(", ");

    const getKategori = (panjang, lebar) => {
      if (panjang >= 3 && lebar >= 0.5) {
        return "RETUR";
      }
      return "SCRAP";
    };

    // 1. PROSES SNAPSHOT LOGGING JIKA MODE EDIT
    if (nomorLhk && nomorLhk !== "AUTO") {
      const [oldHeader] = await conn.query(
        `SELECT * FROM tlhk_sublim_hdr WHERE lsb_nomor = ?`,
        [nomorLhk],
      );
      const [oldDetails] = await conn.query(
        `SELECT * FROM tlhk_sublim_dtl WHERE lsbd_lsb_nomor = ?`,
        [nomorLhk],
      );
      const [oldStock] = await conn.query(
        `SELECT * FROM tmasterstok_mmt WHERE mst_noreferensi = ?`,
        [nomorLhk],
      );

      if (oldHeader.length > 0) {
        const snapshotDataLama = {
          header: oldHeader[0],
          details: oldDetails,
          stock: oldStock,
        };

        await conn.query(
          `INSERT INTO tlhk_history_log (
             lhl_nomor_lhk, lhl_action, lhl_data_old, lhl_user_action, lhl_date_action
           ) VALUES (?, 'EDIT', ?, ?, ?)`,
          [
            nomorLhk,
            JSON.stringify(snapshotDataLama),
            userAction,
            formattedNow,
          ],
        );
      }

      await conn.query(`DELETE FROM tlhk_sublim_dtl WHERE lsbd_lsb_nomor = ?`, [
        nomorLhk,
      ]);
      await conn.query(
        `DELETE FROM tmasterstok_mmt WHERE mst_noreferensi = ?`,
        [nomorLhk],
      );
    }

    // 2. PROSES INSERT / UPDATE HEADER SUBLIM
    if (!nomorLhk || nomorLhk === "AUTO") {
      const yymm = format(new Date(tanggalForm), "yyMM");
      const [maxRows] = await conn.query(
        `SELECT MAX(CAST(SUBSTRING_INDEX(lsb_nomor, '.', -1) AS UNSIGNED)) AS max_num 
         FROM tlhk_sublim_hdr 
         WHERE lsb_nomor LIKE ?`,
        [`${NOMERATOR_MESIN}.${yymm}.%`],
      );

      const nextNum = (maxRows[0].max_num || 0) + 1;
      nomorLhk = `${NOMERATOR_MESIN}.${yymm}.${String(nextNum).padStart(4, "0")}`;

      await conn.query(
        `INSERT INTO tlhk_sublim_hdr 
            (lsb_nomor, lsb_tanggal, lsb_jenis, lsb_shift, lsb_date_Create, lsb_user_create, lsb_gdg_kode, lsb_status, lsb_barcode, lsb_brg_kode, lsb_panjang_bs, lsb_lebar_bs) 
         VALUES (?, ?, 'S', ?, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
        [
          nomorLhk,
          tanggalForm,
          shiftForm,
          userAction,
          gdgKode,
          currentStatus,
          usedBarcode,
          usedKodeBahan,
          panjangBs,
          lebarBs,
        ],
      );
    } else {
      await conn.query(
        `UPDATE tlhk_sublim_hdr 
         SET lsb_tanggal=?, lsb_shift=?, lsb_user_modified=?, lsb_gdg_kode=?, lsb_status=?, lsb_barcode=?, lsb_brg_kode=?, lsb_panjang_bs=?, lsb_lebar_bs=?, lsb_date_modified=NOW() 
         WHERE lsb_nomor=?`,
        [
          tanggalForm,
          shiftForm,
          userAction,
          gdgKode,
          currentStatus,
          usedBarcode,
          usedKodeBahan,
          panjangBs,
          lebarBs,
          nomorLhk,
        ],
      );
    }

    // 3. PROSES DATA DETAIL
    if (details && details.length > 0) {
      const values = details.map((d, i) => {
        const p = parseFloat(d.spk_panjang || 0);
        const l = parseFloat(d.spk_lebar || 0);
        const qtyHasilLhk = parseFloat(d.jumlah_sublim || 0);
        const qtyOrderSpk = parseFloat(d.spk_jmlorder || 0);
        const jMeter = p * l * qtyHasilLhk;

        // Menggunakan finalSisaMeter secara konsisten agar tidak tertimpa nilai 0 dari frontend
        const sisaMeterBaris = finalSisaMeter;

        const namaKomponen = d.lsbd_komponen || d.spk_komponen || "ALL SET";

        return [
          nomorLhk,
          d.spk_nomor,
          d.spk_nama || "",
          tanggalForm,
          tanggalForm,
          qtyOrderSpk,
          p,
          l,
          "-",
          qtyHasilLhk,
          jMeter,
          d.lokasi || "SB01",
          usedKodeBahan,
          i + 1,
          0,
          0,
          d.lsbd_poi_nomor || "",
          d.lsbd_poid_size || "",
          parseFloat(d.lsbd_ambilbahan || maxAmbilPanjang),
          parseFloat(d.lsbd_panjang_pakai || 0),
          parseFloat(d.lsbd_lebar_pakai || 0),
          sisaMeterBaris,
          namaKomponen,
        ];
      });

      const sqlInsertDtl = `
        INSERT INTO tlhk_sublim_dtl (
            lsbd_lsb_nomor, lsbd_spk_nomor, lsbd_spk_nama, lsbd_spk_tanggal, lsbd_dateline, 
            lsbd_jumlah_order, lsbd_panjang, lsbd_lebar, lsbd_mesin, lsbd_jumlah, 
            lsbd_j_meter, lsbd_lokasi, lsbd_bahan, lsbd_no_urut, lsbd_toleransi, 
            lsbd_waste, lsbd_poi_nomor, lsbd_poid_size,
            lsbd_ambilbahan, lsbd_panjang_pakai, lsbd_lebar_pakai, lsbd_sisameter,
            lsbd_komponen
        ) VALUES ?`;

      await conn.query(sqlInsertDtl, [values]);
    }

    // 4. LOGIKA MUTASI STOK BARCODE ROLL (JIKA POSTED)
    if (currentStatus === "POSTED") {
      if (usedBarcode && maxAmbilPanjang > 0) {
        const [oldStockData] = await conn.query(
          `SELECT mst_hargabeli, mst_satuan_harga, mst_lebar 
           FROM tmasterstok_mmt 
           WHERE mst_barcode = ? 
           ORDER BY id DESC LIMIT 1`,
          [usedBarcode],
        );

        const hargaBeliLama =
          oldStockData.length > 0 ? oldStockData[0].mst_hargabeli : 0;
        const satuanHargaLama =
          oldStockData.length > 0 ? oldStockData[0].mst_satuan_harga : null;
        const lebarAwal =
          oldStockData.length > 0 ? oldStockData[0].mst_lebar : initialLebar;

        // A. MUTASI KELUAR
        await conn.query(
          `INSERT INTO tmasterstok_mmt (
              mst_brg_kode, mst_gdg_kode, mst_stok_in, mst_stok_out,
              mst_panjang, mst_lebar, mst_spk_nomor, mst_noreferensi,
              mst_hargabeli, mst_satuan_harga, mst_tanggal, mst_barcode, mst_kategori
           ) VALUES (?, ?, 0, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'RETUR')`,
          [
            usedKodeBahan,
            gdgKode,
            maxAmbilPanjang,
            lebarAwal,
            combinedSpkNomor,
            nomorLhk,
            hargaBeliLama,
            satuanHargaLama,
            formattedDate,
            usedBarcode,
          ],
        );

        // B. MUTASI MASUK (SISA METER)
        if (finalSisaMeter > 0) {
          const kategoriSisa = getKategori(finalSisaMeter, initialLebar);
          await conn.query(
            `INSERT INTO tmasterstok_mmt (
                mst_brg_kode, mst_gdg_kode, mst_stok_in, mst_stok_out,
                mst_panjang, mst_lebar, mst_spk_nomor, mst_noreferensi,
                mst_hargabeli, mst_satuan_harga, mst_tanggal, mst_barcode, mst_kategori
             ) VALUES (?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              usedKodeBahan,
              gdgKode,
              finalSisaMeter,
              initialLebar,
              combinedSpkNomor,
              nomorLhk,
              hargaBeliLama,
              satuanHargaLama,
              formattedDate,
              usedBarcode,
              kategoriSisa,
            ],
          );
        }
      }
    }

    await conn.commit();
    return { success: true, nomor: nomorLhk, status: currentStatus };
  } catch (error) {
    await conn.rollback();
    console.error("CRITICAL SQL ERROR:", error.message);
    return { success: false, message: `Database Error: ${error.message}` };
  } finally {
    conn.release();
  }
};
/**
 * =============================================================================
 * 2. BAGIAN APPROVAL (Rekap ke tlhk_sublim)
 * =============================================================================
 */

const getLookupForApproval = async (tanggal, shift) => {
  let params = [tanggal];
  let sql = `
        SELECT 
            h.lms_nomor AS Nomor, 
            DATE_FORMAT(h.lms_tanggal, '%d-%m-%Y') AS Tanggal, 
            h.lms_shift AS Shift,
            (SELECT lmsd_lokasi FROM tlhk_sublim_dtl WHERE lmsd_lms_nomor = h.lms_nomor LIMIT 1) AS Mesin,
            (SELECT SUM(lmsd_panjang * lmsd_lebar * lmsd_jumlah) FROM tlhk_sublim_dtl WHERE lmsd_lms_nomor = h.lms_nomor) AS Total_Meter
        FROM tlhk_sublim_hdr h
        WHERE h.lms_status = 'POSTED' AND h.lms_tanggal = ?
    `;
  if (shift && shift !== "Semua") {
    sql += ` AND h.lms_shift = ?`;
    params.push(shift);
  }
  const [rows] = await pool.query(sql, params);
  return rows;
};

const saveApproval = async (data) => {
  const { header, details } = data;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Generate nomor approval (MMT-LHK-SA...)
    const yymm = format(new Date(header.tanggal), "yyMM");
    const [maxRows] = await conn.query(
      `SELECT MAX(CAST(SUBSTRING_INDEX(lsb_nomor, '.', -1) AS UNSIGNED)) AS max_num FROM tlhk_sublim_hdr WHERE lsb_nomor LIKE ?`,
      [`${NOMERATOR_APP}.${yymm}.%`],
    );
    const nomorApp = `${NOMERATOR_APP}.${yymm}.${String((maxRows[0].max_num || 0) + 1).padStart(4, "0")}`;

    // 1. Insert ke tlhk_sublim_hdr
    await conn.query(
      `INSERT INTO tlhk_sublim_hdr (lsb_nomor, lsb_tanggal, lsb_gdg_kode, lsb_shift, lsb_user_create, lsb_date_create, lsb_jenis) VALUES (?, ?, ?, ?, ?, NOW(), 'S')`,
      [nomorApp, header.tanggal, header.gdgKode, header.shift, header.admin],
    );

    // 2. Insert ke tlhk_sublim_dtl
    if (details.length > 0) {
      const values = details.map((d, i) => [
        nomorApp,
        i + 1,
        d.nomor_spk,
        d.nama_spk,
        d.panjang,
        d.lebar,
        d.jumlah,
        d.lokasi,
        d.bahan,
        d.jml_order,
      ]);
      await conn.query(
        `INSERT INTO tlhk_sublim_dtl (lsbd_lsb_nomor, lsbd_no_urut, lsbd_spk_nomor, lsbd_spk_nama, lsbd_panjang, lsbd_lebar, lsbd_jumlah, lsbd_lokasi, lsbd_bahan, lsbd_jumlah_order) VALUES ?`,
        [values],
      );

      // 3. Update status di tabel asal (mesinsublim)
      const idsAsal = details.map((d) => d.lhk_nomor);
      await conn.query(
        `UPDATE tlhk_sublim_hdr SET lms_status = 'APPROVED' WHERE lms_nomor IN (?)`,
        [idsAsal],
      );
    }

    await conn.commit();
    return { success: true, nomor: nomorApp };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

/**
 * Mengambil daftar history Approval (tlhk_sublim_hdr)
 */
const getAllApprovalHeaders = async (startDate, endDate) => {
  const tglMulai = format(new Date(startDate), "yyyy-MM-dd");
  const tglSelesai = format(new Date(endDate), "yyyy-MM-dd");

  const sql = `
        SELECT 
            h.lsb_nomor AS Nomor, 
            DATE_FORMAT(h.lsb_tanggal, '%d-%m-%Y') AS Tanggal, 
            h.lsb_shift AS Shift,
            h.lsb_user_create AS Admin,
            h.lsb_jenis AS Jenis,
            (SELECT SUM(lsbd_panjang * lsbd_lebar * lsbd_jumlah) 
             FROM tlhk_sublim_dtl 
             WHERE lsbd_lsb_nomor = h.lsb_nomor) AS Total_Meter,
            (SELECT COUNT(*) 
             FROM tlhk_sublim_dtl 
             WHERE lsbd_lsb_nomor = h.lsb_nomor) AS Jumlah_Item
        FROM tlhk_sublim_hdr h
        WHERE h.lsb_tanggal BETWEEN ? AND ?
        ORDER BY h.lsb_tanggal DESC, h.lsb_nomor DESC
    `;

  const [rows] = await pool.query(sql, [tglMulai, tglSelesai]);
  return rows;
};

/**
 * Mengambil detail Approval berdasarkan nomor (untuk expand row di Browse Approval)
 */
const getApprovalDetailsByNomor = async (nomor) => {
  const sqlDetail = `
        SELECT 
            d.lsbd_lsb_nomor AS Nomor_App,
            d.lsbd_no_urut AS No_Urut,
            d.lsbd_lokasi AS Lokasi, 
            d.lsbd_spk_nomor AS Nomor_SPK, 
            d.lsbd_spk_nama AS Nama_SPK,
            d.lsbd_jumlah AS Jumlah, 
            d.lsbd_bahan AS Bahan, 
            d.lsbd_panjang AS Panjang,
            d.lsbd_lebar AS Lebar,
            (d.lsbd_panjang * d.lsbd_lebar * d.lsbd_jumlah) AS Total_M2
        FROM tlhk_sublim_dtl d
        WHERE d.lsbd_lsb_nomor = ?
        ORDER BY d.lsbd_no_urut
    `;

  const [rows] = await pool.query(sqlDetail, [nomor]);
  return rows;
};

module.exports = {
  getAllHeaders,
  getDetailsByNomor,
  saveLhkMesin,
  getLookupForApproval,
  saveApproval,
  getAllApprovalHeaders,
  getApprovalDetailsByNomor,
  accLhkPaperprint,
};
