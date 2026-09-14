const pool = require("../config/db.config");

/**
 * Mendapatkan daftar user untuk halaman Browse User
 */
const getUserBrowse = async () => {
  const sql = `
    SELECT 
      user_kode, user_nik, user_nama, user_bagian, user_jabat, 
      user_cab, user_cabkaos, user_divisi, user_aktif, date_create 
    FROM tuser 
    ORDER BY user_kode ASC
  `;
  const [rows] = await pool.query(sql);
  return rows;
};

/**
 * Mendapatkan data user beserta hak akses menu berdasarkan user_kode
 */
const getUserAksesByCode = async (userKode) => {
  const [userRows] = await pool.query(
    "SELECT * FROM tuser WHERE user_kode = ?",
    [userKode],
  );
  if (userRows.length === 0) return null;

  const [aksesRows] = await pool.query(
    "SELECT * FROM thakuser WHERE hak_user_kode = ?",
    [userKode],
  );

  return {
    user: userRows[0],
    akses: aksesRows,
  };
};

/**
 * Menyimpan / Memperbarui Hak Akses Menu User (Transaksi Batch / Upsert)
 */
const saveUserAkses = async (userKode, permissions) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const item of permissions) {
      const sql = `
        INSERT INTO thakuser 
        (hak_user_kode, hak_men_id, hak_men_view, hak_men_insert, hak_men_edit, hak_men_delete, hak_men_save)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        hak_men_view = VALUES(hak_men_view),
        hak_men_insert = VALUES(hak_men_insert),
        hak_men_edit = VALUES(hak_men_edit),
        hak_men_delete = VALUES(hak_men_delete),
        hak_men_save = VALUES(hak_men_save)
      `;
      await connection.query(sql, [
        userKode,
        item.id,
        item.view ? "1" : "0",
        item.insert ? "1" : "0",
        item.update ? "1" : "0",
        item.delete ? "1" : "0",
        item.save ? "1" : "0",
      ]);
    }

    await connection.commit();
    return { success: true, message: "Hak akses berhasil disimpan" };
  } catch (error) {
    await connection.rollback();
    throw new Error("Gagal menyimpan hak akses: " + error.message);
  } finally {
    connection.release();
  }
};

module.exports = {
  getUserBrowse,
  getUserAksesByCode,
  saveUserAkses,
};
