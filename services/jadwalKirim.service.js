// backend/src/services/jadwalKirim.service.js
const pool = require('../config/db.config');

/**
 * Mengambil data Jadwal Kirim (Master) 
 * Sesuai logika SQLMaster di ufrmBrowseJadwalKirim2
 */
const getJadwalKirimData = async (startDate, endDate, gudang) => {
  let params = [startDate, endDate];
  
  let sql = `
    SELECT 
      a.Nomor_Kirim AS Nomor, 
      a.Gudang, 
      gdg.gdg_nama AS Nama_Gudang, 
      a.Tanggal,
      a.spk_nomor AS No_SPK, 
      b.spk_nama AS Nama_Spk, 
      b.spk_ukuran AS Ukuran,
      b.spk_kain AS Kain,
      IFNULL(a.Jumlah, 0) AS Jumlah, 
      IFNULL(a.Koli, 0) AS Koli, 
      IFNULL(a.Realisasi, 0) AS Realisasi,
      IFNULL(a.koli_Realisasi, 0) AS Koli_Realisasi, 
      (IFNULL(a.Realisasi, 0) - IFNULL(a.Jumlah, 0)) AS Selisih_Jumlah,
      (IFNULL(a.koli_Realisasi, 0) - IFNULL(a.koli, 0)) AS Selisih_Koli,
      a.usr_create 
    FROM tjadwalkirim a 
    LEFT JOIN (
      SELECT spk_nomor, spk_nama, spk_ukuran, spk_kain FROM tspk WHERE spk_aktif = 'Y'
      UNION ALL 
      SELECT mspk_nomor, mspk_nama, mspk_ukuran, mspk_kain FROM tmemospk
    ) b ON b.spk_nomor = a.spk_nomor
    LEFT JOIN tgudang gdg ON gdg.gdg_kode = a.gudang 
    WHERE a.tanggal >= ? AND a.tanggal <= ?
  `;

  // Filter Gudang (edtgudang.Text)
  if (gudang) {
    sql += ` AND a.gudang LIKE ?`;
    params.push(`%${gudang}%`);
  }

  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.error("Database Master Error:", error);
    throw new Error("Gagal mengambil data Jadwal Kirim");
  }
};

  /**
 * Generate Nomor Kirim otomatis (KRM.YYMM.XXXX)
 * Berdasarkan logika getmaxkode di Delphi
 */
const generateNomorKirim = async (tanggal) => {
  const dateObj = new Date(tanggal);
  const yy = dateObj.getFullYear().toString().substring(2); // Ambil 2 digit tahun
  const mm = ("0" + (dateObj.getMonth() + 1)).slice(-2);    // Ambil 2 digit bulan
  
  const prefix = `KRM.${yy}${mm}.`; // Hasil: KRM.2604.
  const pattern = `${prefix}%`;

  const sql = `
    SELECT IFNULL(MAX(RIGHT(nomor_kirim, 4)), 0) AS last_counter 
    FROM tjadwalkirim 
    WHERE nomor_kirim LIKE ?
  `;

  try {
    const [rows] = await pool.query(sql, [pattern]);
    const lastCounter = parseInt(rows[0].last_counter);
    const nextCounter = (lastCounter + 1).toString().padStart(4, '0');
    
    return `${prefix}${nextCounter}`;
  } catch (error) {
    console.error("Error Generate Nomor Kirim:", error);
    throw new Error("Gagal generate nomor kirim otomatis.");
  }
};

/**
 * Menghapus data Jadwal Kirim
 * Sesuai logika cxButton4Click di ufrmBrowseJadwalKirim2
 */
const deleteJadwalKirim = async (params) => {
  // Di versi JadwalKirim2, penghapusan cukup menggunakan nomor_kirim
  const { nomor } = params; 
  
  const sql = `DELETE FROM tjadwalkirim WHERE nomor_kirim = ?`;

  try {
    const [result] = await pool.query(sql, [nomor]);
    return result.affectedRows > 0;
  } catch (error) {
    console.error("Delete Error:", error);
    throw new Error("Gagal menghapus data jadwal kirim.");
  }
};

const saveJadwalKirim = async (data) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    let {
      Nomor,
      Gudang,
      Tanggal,
      No_SPK,
      Jumlah,
      Koli,
      Realisasi,
      Koli_Realisasi,
      usr_create,
      detail // Array detail dari frontend
    } = data;

    // 1. Logika Auto Number
    if (!Nomor || Nomor === "AUTO") {
      Nomor = await generateNomorKirim(Tanggal, connection);
    }

    // 2. Cek Eksistensi untuk Header
    const [existing] = await connection.query(
      "SELECT Nomor_Kirim FROM tjadwalkirim WHERE Nomor_Kirim = ?",
      [Nomor]
    );

    if (existing.length > 0) {
      // --- UPDATE HEADER ---
      await connection.query(
        `UPDATE tjadwalkirim SET 
          Gudang = ?, Tanggal = ?, spk_nomor = ?, Jumlah = ?, 
          Koli = ?, Realisasi = ?, koli_Realisasi = ?, usr_update = ?, tgl_update = NOW()
         WHERE Nomor_Kirim = ?`,
        [Gudang, Tanggal, No_SPK, Jumlah, Koli, Realisasi, Koli_Realisasi, usr_create, Nomor]
      );
    } else {
      // --- INSERT HEADER ---
      await connection.query(
        `INSERT INTO tjadwalkirim 
          (Nomor_Kirim, Gudang, Tanggal, spk_nomor, Jumlah, Koli, Realisasi, koli_Realisasi, usr_create, date_create) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [Nomor, Gudang, Tanggal, No_SPK, Jumlah, Koli, Realisasi, Koli_Realisasi, usr_create]
      );
    }

    // 3. LOGIKA DETAIL (Sesuai simpandata di Delphi)
    // Hapus detail lama berdasarkan Nomor_Kirim
    await connection.query("DELETE FROM tjadwalkirim_dtl WHERE nomor_kirim = ?", [Nomor]);

    // Insert detail baru jika ada
    if (detail && detail.length > 0) {
      const detailQueries = detail
        .filter(d => d.qty > 0) // Hanya simpan yang qty > 0 sesuai logika Delphi
        .map((d, index) => [
          Nomor,
          index + 1, // no_urut
          d.kota,
          d.uraian,
          d.qty,
          d.koli,
          d.jamInput || '', 
          d.jamReady || '',
          d.expedisi || ''
        ]);

      if (detailQueries.length > 0) {
        await connection.query(
          `INSERT INTO tjadwalkirim_dtl 
            (nomor_kirim, no_urut, kota, uraian, jumlah, koli, jami, jam, expedisi) 
           VALUES ?`,
          [detailQueries]
        );
      }
    }

    await connection.commit();
    return { success: true, message: "Data berhasil disimpan", nomor: Nomor };

  } catch (error) {
    await connection.rollback();
    console.error("Transaction Error:", error);
    throw error;
  } finally {
    connection.release();
  }
};

// Properti module.exports tetap sama agar tidak merusak pemanggilan di Controller
module.exports = {
  getJadwalKirimData,
  deleteJadwalKirim,
  saveJadwalKirim,
  generateNomorKirim
};