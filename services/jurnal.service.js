const pool = require('../config/db.config');
const { format, parseISO, isValid } = require('date-fns');

const throwDbError = (message, error) => {
    console.error(message, error.message);
    throw new Error(message + ': ' + error.message);
};

/**
 * Fungsi Universal untuk Posting Jurnal Manual/Otomatis
 * Menggunakan connection dari transaction agar konsisten
 */
exports.postJurnal = async (connection, { tgl, bukti, keterangan, akun, debet, kredit, user, perush = 'KP' }) => {
    try {
        // 1. Validasi Input Dasar
        if (!akun) throw new Error("Kode Akun (COA) harus diisi.");
        if (!bukti) throw new Error("Nomor Bukti transaksi tidak boleh kosong.");
        
        // Pastikan debet/kredit adalah angka dan bukan NaN
        const valDebet = parseFloat(debet) || 0;
        const valKredit = parseFloat(kredit) || 0;

        // Validasi: Tidak boleh posting jika debet & kredit nol dua-duanya
        if (valDebet === 0 && valKredit === 0) {
            console.warn(`[Jurnal Warning] Transaksi ${bukti} dengan akun ${akun} memiliki nilai 0. Skip posting.`);
            return;
        }

        // 2. SQL Query sesuai struktur tabel tjurnal_mmt
        const sql = `
            INSERT INTO tjurnal_mmt 
            (
                jur_tanggal, 
                jur_bukti, 
                jur_keterangan, 
                jur_akun_kode, 
                jur_debet, 
                jur_kredit, 
                jur_perush_kode,
                user_create
            ) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            tgl,            // jur_tanggal
            bukti,          // jur_bukti
            keterangan,     // jur_keterangan
            akun,           // jur_akun_kode
            valDebet,       // jur_debet
            valKredit,      // jur_kredit
            perush,         // jur_perush_kode
            user            // user_create
        ];

        // 3. Eksekusi query menggunakan connection yang dikirim dari service utama
        return await connection.query(sql, values);

    } catch (error) {
        console.error("Error at jurnal.service.js:", error.message);
        throw new Error("Gagal melakukan posting jurnal: " + error.message);
    }
};