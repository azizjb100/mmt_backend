// backend/services/auth.service.js
const pool = require("../config/db.config");
const jwt = require("jsonwebtoken"); // Kita butuh ini untuk membuat token

// ✅ AMBIL DARI ENV (HARUS SAMA DENGAN MIDDLEWARE)
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET belum diset di environment");
}

/**
 * LOGIN
 */
const loginUser = async (username, password) => {
    const s = `
    SELECT
      user_kode, user_nama, user_aktif, user_edit_report,
      user_lihat_beli, user_lihat_harga, user_cab, user_divisi,
      user_lihat_cus, user_cmo, user_cmo3, user_manager,
      user_bagian, user_jabat, user_acckor, user_password 
    FROM tuser
    WHERE UPPER(user_kode) = ?
  `;

    const [rows] = await pool.query(s, [username.toUpperCase()]);

    if (rows.length === 0) {
        throw new Error("User tidak ditemukan");
    }

    const user = rows[0];

    // Cek password (Jika masih plain text gunakan ini)
    if (password !== user.user_password) {
        throw new Error("Password salah");
    }

    // Cek apakah user aktif (Biasanya 0 = Aktif, 1 = Pasif)
    if (user.user_aktif !== 0) {
        throw new Error("User sudah pasif atau dinonaktifkan");
    }

    // =========================
    // PAYLOAD JWT
    // =========================
    const userPayload = {
        kdUser: user.user_kode,
        nmUser: user.user_nama,
        bagian: user.user_bagian,
        jabat: user.user_jabat,
        divisi: user.user_divisi, // Digunakan di Controller
        cab: user.user_cab,
        user_manager: user.user_manager, // Digunakan di Controller
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: "8h" });

    // =========================
    // LOG LAST LOGIN (Gunakan try-catch agar tidak memutus proses login)
    // =========================
    try {
        const logSql = `
            INSERT INTO pengaturan.tuser_lastupdate (computer, app, versi, usr, date_update)
            VALUES (?, 'WEB_APP', ?, ?, NOW())
            ON DUPLICATE KEY UPDATE versi = ?, usr = ?, date_update = NOW()
        `;
        await pool.query(logSql, ["WEB", "1.0.0", user.user_kode, "1.0.0", user.user_kode]);
    } catch (logError) {
        console.error("Gagal mencatat log login:", logError.message);
        // Kita tidak throw error di sini agar user tetap bisa login meski log gagal
    }

    return {
        token,
        user: userPayload,
        info: {
            mustChangePassword: password === "123",
        },
    };
};

/**
 * Pengganti btnRegisterClick / registrasi
 */
const registerDevice = async (username, cpuId, macAddress) => {
    const s = `
    INSERT INTO pengaturan.tregister (register_id, register_mac, register_user, register_aktif)
    VALUES (?, ?, ?, "N")
    ON DUPLICATE KEY UPDATE register_user = ?
  `;

    // Ganti 'MOCK_CPU_ID' dan 'MOCK_MAC' dengan data asli jika bisa didapat
    const [result] = await pool.query(s, [
        cpuId || "MOCK_CPU_ID",
        macAddress || "MOCK_MAC",
        username,
        username,
    ]);
    return result.affectedRows > 0;
};

/**
 * Pengganti edtUserClickBtn (Form Bantuan)
 */
const getUserHelpers = async () => {
    const s = `
    SELECT user_kode, user_Nama
    FROM tuser
    WHERE user_kode <> "ADMIN" AND user_aktif = 0
    ORDER BY user_Nama
  `;
    const [rows] = await pool.query(s);
    return rows;
};

const getAllUsers = async () => {
    const s = `
    SELECT
      user_kode, user_nama, user_jabat,
      user_bagian, user_cab, user_aktif
    FROM tuser
    ORDER BY user_nama
  `;
    const [rows] = await pool.query(s);
    return rows;
};

module.exports = {
    loginUser,
    registerDevice,
    getUserHelpers,
    getAllUsers,
};
