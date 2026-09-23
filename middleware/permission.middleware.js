// middleware/permission.middleware.js
// Cek hak akses menu user dari tabel thakuser (grid Management User).
// Contoh: checkPermission(1308, "view") untuk menu LMKP.
//
// CATATAN DATA:
// - Data legacy (aplikasi desktop) memakai 'Y'/'N', data web menulis '1'/'0'
//   -> semua nilai truthy ('Y','y','1',1) dianggap izin.
// - Deny-by-default: user tanpa baris untuk menu ini dianggap TIDAK punya akses.
// - thakuser bisa berisi baris duplikat (belum ada UNIQUE key) -> makanya pakai
//   MAX()/aggregate supaya tetap aman walau ada duplikat.

const pool = require("../config/db.config");

// Peta aksi -> kolom (whitelist, jadi aman dari SQL injection via kolom)
const ACTION_COLUMN = {
  view: "hak_men_view",
  insert: "hak_men_insert",
  edit: "hak_men_edit",
  update: "hak_men_edit",
  delete: "hak_men_delete",
  save: "hak_men_save",
};

// 'Y' | '1' | 1 dianggap izin
const isGranted = (value) => {
  if (value === true) return true;
  if (value === null || value === undefined) return false;
  return ["y", "1"].includes(String(value).trim().toLowerCase());
};

const checkPermission = (menuId, action) => {
  const column = ACTION_COLUMN[String(action).toLowerCase()];

  return async (req, res, next) => {
    // verifyToken sudah jalan duluan, jd req.user terisi dari JWT
    const userKode = req.user && req.user.kdUser;
    if (!userKode) {
      return res.status(401).json({
        success: false,
        message: "Token tidak memiliki user",
      });
    }

    if (!column) {
      return res.status(500).json({
        success: false,
        message: `Aksi permission tidak dikenal: ${action}`,
      });
    }

    try {
      const [rows] = await pool.query(
        `SELECT MAX(${column}) AS allowed
         FROM thakuser
         WHERE hak_user_kode = ? AND hak_men_id = ?`,
        [userKode, menuId],
      );

      const allowed = rows.length > 0 && isGranted(rows[0].allowed);

      if (!allowed) {
        // Deny-by-default: tanpa baris / nilai N / 0 -> 403
        return res.status(403).json({
          success: false,
          message: "Anda tidak memiliki hak akses untuk menu ini",
        });
      }

      return next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Gagal memeriksa hak akses: " + error.message,
      });
    }
  };
};

module.exports = { checkPermission };
