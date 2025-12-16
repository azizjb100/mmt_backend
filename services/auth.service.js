// backend/services/auth.service.js
const pool = require('../config/db.config');
const jwt = require('jsonwebtoken'); // Kita butuh ini untuk membuat token

// Kunci rahasia untuk token Anda (simpan di file .env di aplikasi nyata)
const JWT_SECRET = 'kunci-rahasia-anda-yang-sangat-aman';

/**
 * Pengganti btnLoginClick
 */
const loginUser = async (username, password) => {
  const s = `
    SELECT 
      user_kode, user_nama, user_aktif, user_edit_report, 
      user_lihat_beli, user_lihat_harga, user_cab, user_divisi, 
      user_lihat_cus, user_cmo, user_cmo3, user_manager, 
      user_ppic, user_bagian, user_jabat, user_acckor, user_cabkaos 
    FROM tuser 
    WHERE upper(user_kode) = ? AND user_password = ?
  `;
  
  const [rows] = await pool.query(s, [username.toUpperCase(), password]);

  if (rows.length === 0) {
    throw new Error('User atau password salah');
  }

  const user = rows[0];

  if (user.user_aktif !== 0) {
    throw new Error('User sudah pasif');
  }

  // Logika sukses login:
  // 1. Simpan data user untuk token
  const userPayload = {
    kdUser: user.user_kode,
    nmUser: user.user_nama,
    jabat: user.user_jabat,
    divisi: user.user_divisi,
    cab: user.user_cab,
    // Tambahkan field lain yang dibutuhkan di frontend
    lihatHarga: user.user_lihat_harga,
    editReport: user.user_edit_report,
    bagian: user.user_bagian
  };

  // 2. Buat Token (Pengganti session global frmMenu)
  const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '8h' });

  // 3. Log last update (tanpa menunggu selesai)
  const logSql = `
    INSERT INTO pengaturan.tuser_lastupdate (computer, app, versi, usr, date_update) 
    VALUES (?, "WEB_APP", ?, ?, NOW()) 
    ON DUPLICATE KEY UPDATE versi = ?, usr = ?, date_update = NOW()
  `;
  // Ganti 'COMPUTER_NAME', '1.0.0' dengan data asli jika ada
  pool.query(logSql, ['COMPUTER_NAME', '1.0.0', user.user_kode, '1.0.0', user.user_kode]);

  // 4. Kirim kembali data penting
  return {
    token,
    user: userPayload,
    info: {
      mustChangePassword: (password === '123') // Info tambahan
    }
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
  const [result] = await pool.query(s, [cpuId || 'MOCK_CPU_ID', macAddress || 'MOCK_MAC', username, username]);
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
  getAllUsers
};