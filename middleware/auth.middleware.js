const jwt = require('jsonwebtoken');

// ⛔ JANGAN hardcode
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET belum diset di environment');
}

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    // =========================
    // 1. Cek Authorization header
    // =========================
    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: 'Authorization header tidak ditemukan'
        });
    }

    // Support: Bearer / bearer
    const [scheme, token] = authHeader.split(' ');

    if (!/^Bearer$/i.test(scheme) || !token) {
        return res.status(401).json({
            success: false,
            message: 'Format Authorization harus: Bearer <token>'
        });
    }

    // =========================
    // 2. Verify JWT
    // =========================
    try {
        const decoded = jwt.verify(token, JWT_SECRET, {
            clockTolerance: 5 // toleransi 5 detik (hindari error jam server)
        });

        req.user = decoded; // <-- PENTING
        next();

    } catch (err) {
        // =========================
        // 3. Error handling detail
        // =========================
        let message = 'Token tidak valid';

        if (err.name === 'TokenExpiredError') {
            message = 'Token kadaluwarsa, silakan login ulang';
        }

        return res.status(401).json({
            success: false,
            message
        });
    }
};

module.exports = verifyToken;
