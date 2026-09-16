const pool = require("../config/db.config");
const { format } = require("date-fns");

exports.getNewNomorMutasi = async () => {
  const PREFIX = "MMT.MUT";
  try {
    const currentYYMM = format(new Date(), "yyMM");
    const searchPattern = `${PREFIX}.${currentYYMM}.%`;

    const sql = `
            SELECT MAX(mut_nomor) AS MaxNomor 
            FROM tmutasi_hdr 
            WHERE mut_nomor LIKE ?;
        `;

    const [results] = await pool.query(sql, [searchPattern]);
    const maxNomor = results[0].MaxNomor;

    let newNumber = "0001";
    if (maxNomor) {
      const lastNumberString = maxNomor.substring(
        maxNomor.lastIndexOf(".") + 1,
      );
      newNumber = (parseInt(lastNumberString, 10) + 1)
        .toString()
        .padStart(4, "0");
    }
    return `${PREFIX}.${currentYYMM}.${newNumber}`;
  } catch (error) {
    throw new Error("Gagal generate nomor mutasi: " + error.message);
  }
};

exports.saveMutasiInternal = async (data, isUpdate = false, userLogin) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let {
      Nomor,
      Tanggal,
      GudangAsal,
      GudangTujuan,
      Keterangan,
      Type,
      Details,
    } = data;

    const kodeGudangAsal = GudangAsal || "GP001";
    const kodeGudangTujuan = GudangTujuan || "GB001";

    const serverTime = new Date();
    const activeUser = userLogin || "SYSTEM";

    // 1. Handle Nomor Dokumen
    if (!isUpdate && (!Nomor || Nomor === "MUT-AUTO" || Nomor === "AUTO")) {
      Nomor = await exports.getNewNomorMutasi();
    }

    if (isUpdate) {
      // JIKA UPDATE: Kembalikan (Restore) stok lrd_jumlah di detail LHK sebelum dihapus
      const [oldDetails] = await connection.query(
        "SELECT mutd_lhk_detail_id, mutd_nourut, mutd_jumlah FROM tmutasi_dtl WHERE mutd_mut_nomor = ?",
        [Nomor],
      );
      for (const oldItem of oldDetails) {
        if (oldItem.mutd_lhk_detail_id) {
          await connection.query(
            "UPDATE tlhk_rtr_dtl SET lrd_jumlah = lrd_jumlah + ? WHERE lrd_lr_nomor = ? AND lrd_no_urut = ?",
            [
              oldItem.mutd_jumlah,
              oldItem.mutd_lhk_detail_id,
              oldItem.mutd_nourut,
            ],
          );
        }
      }

      // Clean-up data relasi lama (Tanpa tmasterstok_bahan & tmasterstok_mmt)
      await connection.query(
        "DELETE FROM tmutasi_dtl WHERE mutd_mut_nomor = ?",
        [Nomor],
      );

      // 2. Update Header Mutasi
      await connection.query(
        `UPDATE tmutasi_hdr SET 
                    mut_tanggal=?, mut_gdg_asal=?, mut_gdg_tujuan=?, 
                    mut_keterangan=?, mut_type=?, user_modified=?, date_modified=? 
                 WHERE mut_nomor=?`,
        [
          Tanggal,
          kodeGudangAsal,
          kodeGudangTujuan,
          Keterangan,
          Type || 1,
          activeUser,
          serverTime,
          Nomor,
        ],
      );
    } else {
      // 2. Insert Header Baru Mutasi
      await connection.query(
        `INSERT INTO tmutasi_hdr 
                    (mut_nomor, mut_tanggal, mut_gdg_asal, mut_gdg_tujuan, mut_keterangan, mut_type, mut_status_realisasi, user_create, date_create) 
                 VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          Nomor,
          Tanggal,
          kodeGudangAsal,
          kodeGudangTujuan,
          Keterangan,
          Type || 1,
          activeUser,
          serverTime,
        ],
      );
    }

    // 3. Insert Details
    if (Details && Details.length > 0) {
      const groupedDetailsMap = new Map();

      for (const d of Details) {
        const key = `${d.brg_kode || d.kode_barang || "-"}_${d.lhk_detail_id || d.Nomor || "null"}_${d.No_Urut || 0}`;
        if (groupedDetailsMap.has(key)) {
          const existing = groupedDetailsMap.get(key);
          existing.qty_mutasi += Number(d.qty_mutasi);
        } else {
          groupedDetailsMap.set(key, {
            ...d,
            qty_mutasi: Number(d.qty_mutasi),
          });
        }
      }

      const finalDetails = Array.from(groupedDetailsMap.values());

      // Ubah menggunakan index perulangan agar mutd_nourut dijamin unik (1, 2, 3, dst.)
      for (let i = 0; i < finalDetails.length; i++) {
        const item = finalDetails[i];
        const currentNoUrut = i + 1; // Nomor urut unik berdasarkan indeks array
        const brgKode = item.brg_kode || item.kode_barang || "-";

        let lhkNomor = item.lhk_nomor || item.Nomor;
        let lhkNoUrut = item.No_Urut || item.lrd_no_urut;

        if (
          !lhkNomor &&
          item.lhk_detail_id &&
          typeof item.lhk_detail_id === "string" &&
          item.lhk_detail_id.includes("_")
        ) {
          const parts = item.lhk_detail_id.split("_");
          lhkNoUrut = parseInt(parts.pop(), 10);
          lhkNomor = parts.join("_");
        }

        lhkNomor = lhkNomor || "-";
        lhkNoUrut = Number(lhkNoUrut) || 1;

        const [stokCheck] = await connection.query(
          "SELECT lrd_jumlah FROM tlhk_rtr_dtl WHERE lrd_lr_nomor = ? AND lrd_no_urut = ?",
          [lhkNomor, lhkNoUrut],
        );
        const currentStok = stokCheck[0]?.lrd_jumlah || 0;

        // Insert Detail ke tmutasi_dtl dengan currentNoUrut yang pasti ada dan unik
        await connection.query(
          `INSERT INTO tmutasi_dtl 
        (mutd_mut_nomor, mutd_brg_kode, mutd_lhk_detail_id, mutd_spk_nomor, mutd_poi_nomor, mutd_poi_size, mutd_nama_komponen, mutd_jumlah, mutd_stok_sublim_lama, mutd_keterangan, mutd_nourut) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            Nomor,
            brgKode,
            lhkNoUrut,
            item.Nomor_SPK || item.nomor_spk || "-",
            item.No_PO_Internal || item.poi_nomor || "-",
            item.lrd_poid_size || item.poi_size || "",
            item.lrd_spk_nama || item.nama_komponen || "",
            item.qty_mutasi,
            currentStok,
            item.keterangan || "",
            Number(currentNoUrut), // <-- Pastikan dipaksa menjadi angka (Integer) di sini
          ],
        );

        // Potong Qty di Log Kerja Sublim Detail
        await connection.query(
          "UPDATE tlhk_rtr_dtl SET lrd_jumlah = lrd_jumlah - ? WHERE lrd_lr_nomor = ? AND lrd_no_urut = ?",
          [item.qty_mutasi, lhkNomor, lhkNoUrut],
        );

        // Update flag `lr_mutasi` di header LHK
        await connection.query(
          "UPDATE tlhk_rtr_hdr SET lr_mutasi = 1 WHERE lr_nomor = ?",
          [lhkNomor],
        );
      }
    }

    await connection.commit();
    return { success: true, nomor: Nomor };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

exports.getMutasiData = async (startDate, endDate) => {
  try {
    const sqlMaster = `
            SELECT 
                h.mut_nomor AS Nomor_Mutasi,
                h.mut_tanggal AS Tanggal,
                h.mut_gdg_asal AS Bagian_Asal,
                h.mut_gdg_tujuan AS Bagian_Tujuan,
                h.mut_keterangan AS Keterangan,
                h.mut_status_realisasi AS Status,
                COALESCE((SELECT SUM(mutd_jumlah) FROM tmutasi_dtl WHERE mutd_mut_nomor = h.mut_nomor), 0) AS Total_Qty
            FROM tmutasi_hdr h
            WHERE h.mut_tanggal BETWEEN ? AND ?
            ORDER BY h.date_create DESC
        `;

    const [masterResults] = await pool.query(sqlMaster, [startDate, endDate]);
    return masterResults;
  } catch (error) {
    throw new Error("Gagal tarik data master mutasi: " + error.message);
  }
};

exports.getMutasiDetailByNomor = async (nomor) => {
  try {
    const sqlDetail = `
            SELECT 
                d.mutd_lhk_detail_id AS Lhk_Detail_Id,
                d.mutd_mut_nomor AS Nomor_Mutasi,
                d.mutd_spk_nomor AS Nomor_SPK,
                d.mutd_poi_nomor AS No_PO_Internal,
                d.mutd_poi_size AS Size,
                d.mutd_nama_komponen AS Nama_Komponen,
                d.mutd_jumlah AS Qty_Mutasi,
                d.mutd_stok_sublim_lama AS Stok_Sublim_Lama,
                s.spk_nama AS Nama_SPK
            FROM tmutasi_dtl d
            LEFT JOIN tspk s ON d.mutd_spk_nomor = s.spk_nomor
            WHERE d.mutd_mut_nomor = ?
            ORDER BY d.mutd_nourut ASC
        `;
    const [detailResults] = await pool.query(sqlDetail, [nomor]);
    return detailResults;
  } catch (error) {
    throw new Error("Gagal tarik data detail mutasi: " + error.message);
  }
};

exports.deleteMutasiGudang = async (nomor) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Ambil detail untuk pemulihan sisa stok LHK Sublim
    const [details] = await connection.query(
      "SELECT mutd_lhk_detail_id, mutd_jumlah FROM tmutasi_dtl WHERE mutd_mut_nomor = ?",
      [nomor],
    );

    // 2. Kembalikan sisa ke tabel LHK
    for (const item of details) {
      if (item.mutd_lhk_detail_id) {
        await connection.query(
          "UPDATE tlhk_rtr_dtl SET lr_mutasi = lr_mutasi + ? WHERE Id = ?",
          [item.mutd_jumlah, item.mutd_lhk_detail_id],
        );
      }
    }

    // 3. Hapus data di masterstok & mutasi (Hdr + Dtl)
    await connection.query(
      "DELETE FROM tmasterstok_bahan WHERE mst_noreferensi = ?",
      [nomor],
    );
    await connection.query(
      "DELETE FROM tmasterstok_mmt WHERE mst_noreferensi = ?",
      [nomor],
    );
    await connection.query("DELETE FROM tmutasi_dtl WHERE mutd_mut_nomor = ?", [
      nomor,
    ]);
    await connection.query("DELETE FROM tmutasi_hdr WHERE mut_nomor = ?", [
      nomor,
    ]);

    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
