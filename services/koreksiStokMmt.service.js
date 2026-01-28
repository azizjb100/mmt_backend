// backend/src/services/koreksiStokService.js

const pool = require('../config/db.config'); // Asumsi modul koneksi database Anda
const { format } = require('date-fns');

// Helper untuk penanganan error database
const throwDbError = (message, error) => {
  console.error(message, error.message);
  throw new Error(message + ': ' + error.message);
};

// ========================================================
// READ MASTER DATA (btnRefreshClick - SQLMaster)
// ========================================================
exports.getKoreksiStokData = async (startDate, endDate) => {
  try {
    // TAHAP 1: Ambil Master
    const sqlMaster = `
      SELECT 
        a.korh_nomor AS Nomor, 
        DATE_FORMAT(a.korh_tanggal, '%d-%M-%Y') AS Tanggal, 
        b.gdg_nama AS Gudang, 
        c.nama AS Tipe_Nama, 
        a.korh_notes AS Keterangan
      FROM tkor_hdr_mmt a
      LEFT JOIN tgudang b ON b.gdg_kode = a.korh_gdg_kode
      LEFT JOIN tkor_type_mmt c ON c.kode = a.korh_type
      WHERE a.korh_tanggal BETWEEN ? AND ? 
        AND IFNULL(a.korh_typekor, 0) = 0 
        AND b.gdg_kode LIKE '%WH-%' OR b.gdg_kode = 'GPM'
      GROUP BY a.korh_nomor, a.korh_tanggal, a.korh_notes, b.gdg_nama, a.korh_type, c.nama
      ORDER BY a.korh_tanggal DESC`;

    const params = [
      format(new Date(startDate), 'yyyy-MM-dd'),
      format(new Date(endDate), 'yyyy-MM-dd')
    ];

    const [masterRows] = await pool.query(sqlMaster, params);
    if (masterRows.length === 0) return [];

    const nomorList = masterRows.map(m => m.Nomor);

    // TAHAP 2: Ambil Detail + Subquery untuk List_Barcode (SAMA DENGAN PENERIMAAN)
    const sqlDetail = `
      SELECT 
        d.kord_korh_nomor AS Nomor, 
        d.kord_brg_kode AS Kode, 
        b.brg_nama AS Nama_Bahan, 
        d.kord_stok AS Stock, 
        d.kord_panjang AS Panjang, 
        d.kord_lebar AS Lebar,
        d.kord_fisik AS Fisik, 
        d.kord_qty AS Koreksi,
        d.kord_satuan AS Satuan,
        -- Mengambil barcode unik dari tabel stok berdasarkan nomor referensi koreksi
        (SELECT GROUP_CONCAT(mst_barcode ORDER BY mst_barcode ASC) 
         FROM tmasterstok_mmt 
         WHERE mst_noreferensi = d.kord_korh_nomor 
         AND mst_brg_kode = d.kord_brg_kode) AS List_Barcode
      FROM tkor_dtl_mmt d
      JOIN tbarang_mmt b ON d.kord_brg_kode = b.brg_kode
      WHERE d.kord_korh_nomor IN (?)
      ORDER BY d.kord_korh_nomor, d.kord_nourut`;

    const [detailRows] = await pool.query(sqlDetail, [nomorList]);

    // TAHAP 3: Gabungkan (Mapping menggunakan Map agar lebih cepat)
    const dataMap = new Map();
    masterRows.forEach(item => {
      dataMap.set(item.Nomor, { ...item, Detail: [] });
    });

    detailRows.forEach(detail => {
      if (dataMap.has(detail.Nomor)) {
        dataMap.get(detail.Nomor).Detail.push(detail);
      }
    });

    return Array.from(dataMap.values());

  } catch (error) {
    console.error("Gagal mengambil data koreksi stok:", error);
    throw error;
  }
};


// ========================================================
// DELETE (cxButton4Click)
// ========================================================
exports.deleteKoreksiStok = async (nomor, user) => {
  const connection = await pool.getConnection();
  // Asumsi cekdelete sudah dilakukan di frontend
  try {
    await connection.beginTransaction();

    // 1. Hapus Detail (tkor_dtl_mmt)
    const sqlDeleteDetail = 'DELETE FROM tkor_dtl_mmt WHERE kord_korh_nomor = ?';
    await connection.query(sqlDeleteDetail, [nomor]);

    // 2. Hapus Header (tkor_hdr_mmt)
    const sqlDeleteHeader = 'DELETE FROM tkor_hdr_mmt WHERE korh_nomor = ?';
    const [headerResult] = await connection.query(sqlDeleteHeader, [nomor]);
    
    if (headerResult.affectedRows === 0) {
      throw new Error("Nomor transaksi tidak ditemukan atau sudah terhapus.");
    }
    
    await connection.commit();
    return true;
    
  } catch (error) {
    await connection.rollback();
    throwDbError('Gagal menghapus transaksi Koreksi Stok', error);
  } finally {
    connection.release();
  }
};

// ========================================================
// GENERATE MAX KODE (getmaxkode)
// ========================================================
exports.generateMaxKode = async (tanggal) => {
  const NOMERATOR = 'KOR'; // Contoh nomerator
  const yyMm = format(new Date(tanggal), 'yyMM');
  
  // Mengambil max nomor (asumsi menggunakan kode 3 digit setelah tanggal)
  const sql = `
    SELECT MAX(RIGHT(korh_nomor, 3)) AS max_num 
    FROM tkor_hdr_mmt 
    WHERE korh_nomor LIKE ?
  `;
  const prefix = `${NOMERATOR}.${yyMm}.%`;
  const [rows] = await pool.query(sql, [prefix]);
  
  const maxNum = rows[0].max_num ? parseInt(rows[0].max_num) : 0;
  const newSequence = maxNum + 1; 
  
  return `${NOMERATOR}.${yyMm}.${String(newSequence).padStart(3, '0')}`;
};


exports.getStokGudangAll = async (gdg_kode, tanggal) => {
    const sql = `
        SELECT 
            brg_kode AS Kode,
            brg_nama AS Nama,
            brg_satuan AS Satuan,
            brg_panjang AS Panjang,
            brg_lebar AS Lebar,
            gdg_nama AS Gudang,
            SUM(mst_stok_in - mst_stok_out) AS Stok,
            0 AS HRGBELI 
        FROM tbarang_mmt 
        INNER JOIN tmasterstok_mmt ON mst_brg_kode = brg_kode  
        INNER JOIN tgudang ON gdg_kode = mst_gdg_kode 
        WHERE mst_gdg_kode = ?
          AND mst_tanggal <= ?
          AND gdg_kode LIKE '%WH-%'
          AND brg_satuan = 'ROLL' -- Tambahkan baris ini untuk filter satuan
        GROUP BY mst_gdg_kode, brg_kode,  brg_lebar, gdg_nama, brg_nama, brg_satuan
        ORDER BY brg_kode ASC;
    `;
    try {
        // Jika parameter tanggal kosong, gunakan tanggal hari ini
        const [rows] = await pool.query(sql, [gdg_kode, tanggal || new Date()]);
        return rows;
    } catch (error) {
        throw error;
    }
};
exports.getBarangWithStok = async (keyword, gdg_kode, tanggal) => {
    const sql = `
        SELECT 
            brg_kode AS Kode, 
            brg_nama AS NamaBarang, 
            jb_nama AS Jenis, 
            sup_nama AS Supplier, 
            brg_satuan AS Satuan, 
            brg_panjang AS Panjang, 
            brg_lebar AS Lebar, 
            brg_gramasi AS Konstruksi, 
            IFNULL(X.STOK, 0) AS STOK,
            brg_hrgbeli AS HargaBeli -- Diambil untuk mengisi clHarga di Delphi
        FROM tbarang_mmt 
        LEFT JOIN (
            SELECT 
                mst_brg_kode, 
                SUM(mst_stok_in - mst_stok_out) AS STOK 
            FROM tmasterstok_mmt 
            WHERE mst_gdg_kode = ? 
              AND mst_tanggal <= ? 
            GROUP BY MST_BRG_KODE
        ) X ON X.mst_brg_kode = brg_kode 
        LEFT JOIN tjenisbarang ON jb_kode = brg_jenis 
        LEFT JOIN tsupplier ON sup_kode = brg_sup_kode 
        WHERE brg_gdg_default = 'WH-16' -- Sesuai filter di Delphi
          AND (brg_kode LIKE ? OR brg_nama LIKE ?)
    `;
    try {
        const search = `%${keyword}%`;
        const [rows] = await pool.query(sql, [gdg_kode, tanggal, search, search]);
        return rows;
    } catch (error) {
        throw error;
    }
};


// backend/src/services/koreksiStokMmt.service.js

exports.saveKoreksiStokMMT = async (payload, user) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { header, details } = payload;
    let nomor = header.Nomor;

    // 1. Generate nomor jika AUTO
    if (nomor === 'AUTO' || !nomor) {
      nomor = await this.generateMaxKode(header.Tanggal);
    }

    // 2. Simpan atau Update Header
    const sqlHeader = `
      INSERT INTO tkor_hdr_mmt (
        korh_nomor, korh_tanggal, korh_gdg_kode, korh_type, 
        korh_notes, korh_total, date_create, user_create
      )
      VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
      ON DUPLICATE KEY UPDATE
        korh_tanggal = VALUES(korh_tanggal),
        korh_gdg_kode = VALUES(korh_gdg_kode),
        korh_type = VALUES(korh_type),
        korh_notes = VALUES(korh_notes),
        korh_total = VALUES(korh_total),
        date_modified = NOW(),
        user_modified = ?
    `;
    
    // Pastikan totalNilai adalah angka
    const totalNilai = details.reduce((acc, curr) => acc + (Number(curr.Nilai) || 0), 0);
    
    await connection.query(sqlHeader, [
      nomor, header.Tanggal, header.GudangKode, header.TypeKor, 
      header.Keterangan || '', totalNilai, user, user
    ]);

    // 3. Hapus Detail lama
    await connection.query("DELETE FROM tkor_dtl_mmt WHERE kord_korh_nomor = ?", [nomor]);

    // 4. Simpan Detail baru
    if (details.length > 0) {
      const validDetails = details.filter(d => d.SKU);
      const today = format(new Date(), 'yyyy-MM-dd');

      const detailValues = validDetails.map((d, i) => {
        const expiredDate = (d.Expired && d.Expired !== '' && d.Expired !== '0000-00-00') 
                            ? format(new Date(d.Expired), 'yyyy-MM-dd') 
                            : today;

        return [
          nomor, 
          d.SKU, 
          d.Satuan || '', 
          expiredDate,
          Number(d.Qty) || 0,       // KORD_QTY
          Number(d.Panjang) || 0,   // KORD_PANJANG (Solusi Error Truncated)
          Number(d.Lebar) || 0,     // KORD_LEBAR
          Number(d.Harga) || 0,     // KORD_HARGA
          Number(d.Nilai) || 0,     // KORD_NILAI
          Number(d.Fisik) || 0,     // KORD_FISIK
          Number(d.System) || 0,    // KORD_STOK
          i + 1                     // KORD_NOURUT
        ];
      });

      const sqlDetail = `
        INSERT INTO tkor_dtl_mmt (
          kord_korh_nomor, kord_brg_kode, kord_satuan, kord_expired, 
          kord_qty, kord_panjang, kord_lebar, kord_harga, kord_nilai, 
          kord_fisik, kord_stok, kord_nourut
        )
        VALUES ?
      `;
      await connection.query(sqlDetail, [detailValues]);
    }

    await connection.commit();
    return { success: true, nomor: nomor };
  } catch (error) {
    await connection.rollback();
    console.error("Error in saveKoreksiStokMMT:", error.message);
    throw error;
  } finally {
    connection.release();
  }
};