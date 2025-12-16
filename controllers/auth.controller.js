// backend/controllers/auth.controller.js
// Kita tambahkan 'jsonwebtoken' untuk backend
// Jalankan di terminal backend: npm install jsonwebtoken
const authService = require('../services/auth.service');

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Username dan Password harus diisi' });
    }

    const loginData = await authService.loginUser(username, password);
    
    // Kirim token, data user, dan info tambahan
    res.json(loginData);

  } catch (error) {
    // Tangkap error dari service (cth: "User pasif")
    res.status(401).json({ message: error.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { username } = req.body; // Ambil data lain jika perlu
    if (!username) {
      return res.status(400).json({ message: 'User harus diisi' });
    }
    
    await authService.registerDevice(username, null, null);
    res.status(201).json({ message: 'Sudah diregistrasi. Tunggu Acc dari IT.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal registrasi', error: error.message });
  }
};

exports.getUserList = async (req, res) => {
  try {
    const users = await authService.getUserHelpers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data user', error: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await authService.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil semua data user', error: error.message });
  }
};