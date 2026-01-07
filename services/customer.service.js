// backend/src/services/customer.service.js

const pool = require('../config/db.config');

const throwDbError = (message, error) => {
    console.error(message, error.message);
    throw new Error(message + ': ' + error.message);
};

// ===================================
// READ ALL / BROWSE (getBrowseCustomer)
// ===================================
exports.getBrowseCustomer = async (statusFilter = 'ALL') => {
    try {
        let jns = '';
        // Logika sesuai "case cbkorporasi.ItemIndex" di Delphi
        if (statusFilter === 'KORPORASI') jns = 'Y';
        else if (statusFilter === 'PERSEORANGAN') jns = 'N';
        else jns = '';

        const sql = `
            SELECT 
                cus_kode AS Kode,
                cus_nama AS Nama,
                cus_alamat AS Alamat,
                cus_kota AS Kota,
                cus_fax AS Fax,
                cus_telp AS Telp,
                cus_cp AS Contact,
                cus_email AS Email,
                cus_piutang AS Piutang,
                IF(cus_korporasi = 'Y', 'KORPORASI', 'PERORANGAN') AS Status,
                cus_jenisusaha AS JenisUsaha,
                cus_npwp AS NPWP,
                cus_kodei AS Induk,
                cus_prioritas AS Prioritas,
                IF(cus_aktif = 0, '', 'YA') AS Pasif
            FROM tcustomer 
            WHERE cus_iscabang = 0 
            AND cus_korporasi LIKE ?
            ORDER BY cus_nama ASC;
        `;

        const [results] = await pool.query(sql, [`%${jns}%`]);
        return results;

    } catch (error) {
        throwDbError('Gagal mengambil data Browse Customer', error);
    }
};

// ===================================
// GET BY KODE (loaddata)
// ===================================
exports.getCustomerByKode = async (kode) => {
    try {
        const sql = `SELECT * FROM tcustomer WHERE cus_kode = ?`;
        const [results] = await pool.query(sql, [kode]);

        if (results.length === 0) {
            throw new Error(`Customer dengan kode ${kode} tidak ditemukan.`);
        }
        return results[0];
    } catch (error) {
        throwDbError(`Gagal mengambil data customer ${kode}`, error);
    }
};

// ===================================
// LOOKUP CUSTOMER
// ===================================
/**
 * Digunakan untuk komponen pencarian/dropdown yang ringan
 */
exports.getCustomerLookup = async (search = '') => {
    try {
        const sql = `
            SELECT 
                cus_kode AS Kode, 
                cus_nama AS Nama, 
                cus_alamat AS Alamat,
                cus_kota AS Kota
            FROM tcustomer 
            WHERE (cus_nama LIKE ? OR cus_kode LIKE ?)
            AND cus_aktif = 0
            ORDER BY cus_nama ASC 
            LIMIT 100;
        `;
        const [results] = await pool.query(sql, [`%${search}%`, `%${search}%`]);
        return results;
    } catch (error) {
        throwDbError('Gagal mengambil data Lookup Customer', error);
    }
};

// ===================================
// SAVE (Insert / Update)
// ===================================
exports.saveCustomer = async (data, kodeToEdit, userLogin) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Dalam Delphi, kode biasanya diinput manual atau ada generator sendiri
        const currentKode = kodeToEdit || data.Kode;

        if (kodeToEdit) {
            // UPDATE
            const sqlUpdate = `
                UPDATE tcustomer SET
                    cus_nama = ?,
                    cus_alamat = ?,
                    cus_kota = ?,
                    cus_telp = ?,
                    cus_fax = ?,
                    cus_cp = ?,
                    cus_email = ?,
                    cus_korporasi = ?,
                    cus_jenisusaha = ?,
                    cus_npwp = ?,
                    cus_prioritas = ?,
                    cus_aktif = ?,
                    user_modified = ?,
                    date_modified = NOW()
                WHERE cus_kode = ?
            `;
            await connection.query(sqlUpdate, [
                data.Nama, data.Alamat, data.Kota, data.Telp, data.Fax,
                data.Contact, data.Email, data.Korporasi, data.JenisUsaha,
                data.Npwp, data.Prioritas, data.Pasif === 'YA' ? 1 : 0,
                userLogin, currentKode
            ]);
        } else {
            // INSERT
            const sqlInsert = `
                INSERT INTO tcustomer 
                (cus_kode, cus_nama, cus_alamat, cus_kota, cus_telp, cus_fax, 
                 cus_cp, cus_email, cus_korporasi, cus_jenisusaha, cus_npwp, 
                 cus_prioritas, cus_aktif, user_create, date_create)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;
            await connection.query(sqlInsert, [
                currentKode, data.Nama, data.Alamat, data.Kota, data.Telp, data.Fax,
                data.Contact, data.Email, data.Korporasi, data.JenisUsaha,
                data.Npwp, data.Prioritas, data.Pasif === 'YA' ? 1 : 0, userLogin
            ]);
        }

        await connection.commit();
        return { Kode: currentKode };

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

// ===================================
// DELETE
// ===================================
exports.deleteCustomer = async (kode) => {
    try {
        const [result] = await pool.query('DELETE FROM tcustomer WHERE cus_kode = ?', [kode]);
        return result.affectedRows > 0;
    } catch (error) {
        throwDbError('Gagal menghapus data customer', error);
    }
};