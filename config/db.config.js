// config/db.config.js

// [PERUBAHAN 1] Import mysql2/promise
const mysql = require('mysql2/promise');

// Import dotenv dan panggil config()
require('dotenv').config();

// Gunakan variabel dari process.env
const dbConfig = {
host: process.env.DB_HOST,
user: process.env.DB_USER,
password: process.env.DB_PASSWORD,
database: process.env.DB_NAME,
waitForConnections: true,
connectionLimit: 10,
queueLimit: 0
};

// [PERUBAHAN 2] Buat koneksi pool menggunakan config di atas
const pool = mysql.createPool(dbConfig);

// [PERUBAHAN 3] Ekspor POOL-nya, BUKAN config-nya
module.exports = pool;