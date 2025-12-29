const jwt = require('jsonwebtoken');
const JWT_SECRET = 'kunci-rahasia-anda-yang-sangat-aman'; // Pastikan sama dengan di service

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Mengambil token dari "Bearer <TOKEN>"

    if (!token) {
        return res.status(401).json({ message: 'Akses ditolak, token tidak ada' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Masukkan data user ke objek req agar bisa dipakai di controller manapun
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Token tidak valid atau kadaluwarsa' });
    }
};

module.exports = verifyToken;